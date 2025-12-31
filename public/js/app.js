
import { initP2P, createOffer, joinOffer, sendFile, cleanup } from './p2p.js?v=premium'
import { createSession, getSession } from './api.js?v=premium'
import { showToast, showStatus, hideStatus, formatBytes } from './utils.js?v=premium'

// Main app state
const state = {
    peer: null,
    isHost: false,
    isConnected: false,
    connectionCode: '',
    pendingFiles: [], // Files selected from "Send" page, waiting to be offered
    receivingFiles: new Map(), // map of fileName -> receiveState
    sendingFiles: new Map() // map of fileName -> File object
}

let currentReceive = null

// View Management
const views = {
    landing: document.getElementById('view-landing'),
    receive: document.getElementById('view-receive'),
    host: document.getElementById('view-host'),
    chat: document.getElementById('view-chat')
}

function switchView(viewName) {
    Object.values(views).forEach(el => el && el.classList.add('hidden'))
    if (views[viewName]) {
        views[viewName].classList.remove('hidden')
    }
}

// Expose routing for HTML buttons
window.showReceiveView = () => switchView('receive')
window.showLandingView = () => switchView('landing')


// Initialize
window.addEventListener('DOMContentLoaded', () => {
    // Check if we are auto-joining (url has code)
    if (checkURLForCode()) return

    // Otherwise show landing
    switchView('landing')

    setupEventListeners()
    console.log('Flashare: Chat-First UI Loaded')
})


function setupEventListeners() {
    const fileInputInit = document.getElementById('fileInputInit')
    const fileInputChat = document.getElementById('fileInputChat')

    // 1. Initial Send Click (from Landing)
    if (fileInputInit) {
        fileInputInit.addEventListener('change', (e) => {
            const files = Array.from(e.target.files)
            if (files.length > 0) {
                startHostingSession(files)
            }
        })
    }

    // 2. Chat Attachment Click (from Chat Room)
    if (fileInputChat) {
        fileInputChat.addEventListener('change', (e) => {
            const files = Array.from(e.target.files)
            if (files.length > 0) {
                handleChatFiles(files)
            }
        })
    }
}

// ------------------------------------------
// HOSTING FLOW (SENDER)
// ------------------------------------------

async function startHostingSession(files) {
    showStatus(spinner('Creating room...'))

    try {
        state.pendingFiles = files // Queue for later (when chat connects)

        const { code, peerId } = await createOffer()
        state.connectionCode = code
        state.isHost = true

        state.peer = await initP2P(true, (peer) => {
            setupPeerListeners(peer)
        })

        const offer = await new Promise(resolve => state.peer.once('signal', resolve))
        await createSession(offer, state.connectionCode)

        hideStatus()
        switchView('host')

        // Update Lobby UI
        document.getElementById('displayCode').textContent = code
        document.getElementById('shareLink').value = window.location.origin + '/#' + code

        waitForAnswer(code)

    } catch (error) {
        hideStatus()
        showToast('Error: ' + error.message)
        switchView('landing')
    }
}

async function waitForAnswer(code) {
    const pollInterval = setInterval(async () => {
        if (!state.peer || state.isConnected) {
            clearInterval(pollInterval)
            return
        }

        try {
            const data = await getSession(code)
            if (data && data.p2p_answer) {
                clearInterval(pollInterval)
                showStatus(spinner('Connecting to peer...'))
                const answer = JSON.parse(data.p2p_answer)
                state.peer.signal(answer)
            }
        } catch (e) {
            // Only log real errors
            if (!e.message.includes('Session not found')) {
                console.error('Polling error:', e)
            }
        }
    }, 2000)
}

// ------------------------------------------
// JOINING FLOW (RECEIVER)
// ------------------------------------------

window.joinConnection = async () => {
    const input = document.getElementById('joinInput').value.trim()
    if (!input) {
        showToast('Please enter a code')
        return
    }

    const code = extractCode(input)
    showStatus(spinner('Joining connection...'))

    try {
        const offerData = await getSession(code)

        state.peer = await initP2P(false, (peer) => {
            setupPeerListeners(peer)
        })

        await joinOffer(state.peer, offerData)

        state.connectionCode = code
        state.isHost = false

        hideStatus()
        showStatus(spinner('Connecting to peer...'))

    } catch (error) {
        hideStatus()
        showToast('Failed to join: ' + error.message)
        if (document.getElementById('view-receive').classList.contains('hidden')) {
            switchView('landing')
        }
    }
}

// ------------------------------------------
// P2P & CHAT LOGIC
// ------------------------------------------

function setupPeerListeners(peer) {
    peer.on('connect', () => {
        state.isConnected = true
        hideStatus()
        showToast('✓ Connected!')

        switchView('chat')
        document.getElementById('headerStatus').classList.remove('hidden')

        // If host, process the files selected on Landing Page
        if (state.pendingFiles && state.pendingFiles.length > 0) {
            handleChatFiles(state.pendingFiles)
            state.pendingFiles = []
        }
    })

    peer.on('data', handlePeerData)

    peer.on('error', (err) => {
        console.error('Peer error:', err)
        showToast('Connection error')
    })

    peer.on('close', () => {
        showToast('Connection closed')
        disconnect()
    })
}

function handlePeerData(data) {
    try {
        const message = JSON.parse(data.toString())

        switch (message.type) {
            case 'chat':
                appendChat('Peer', message.text, 'bg-gray-100 text-gray-800')
                break
            case 'fileOffer':
                appendChatFile('peer', message.fileName, message.fileSize, 'offer')
                break
            case 'fileAccept':
                startSendingFile(message.fileName)
                break
            case 'fileStart':
                startReceivingFile(message.fileName, message.fileSize)
                break
            case 'fileComplete':
                completeFileReceive(message.fileName)
                break
        }
    } catch (e) {
        // Binary data
        handleFileChunk(data)
    }
}

// ------------------------------------------
// FILE HANDLING (CHAT STYLE)
// ------------------------------------------

async function handleChatFiles(files) {
    for (const file of files) {
        state.sendingFiles.set(file.name, file)

        // 1. Send Offer
        const metadata = {
            type: 'fileOffer',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
        }
        state.peer.send(JSON.stringify(metadata))

        // 2. Render "Sent" Bubble
        appendChatFile('me', file.name, file.size, 'sent')
    }
}

window.acceptFile = (fileName) => {
    state.peer.send(JSON.stringify({
        type: 'fileAccept',
        fileName: fileName
    }))

    // UI Update
    const idSafe = fileName.replace(/[^a-zA-Z0-9]/g, '')
    const btn = document.getElementById(`btn-${idSafe}`)
    if (btn) {
        btn.textContent = 'Downloading...'
        btn.disabled = true
        btn.classList.add('opacity-75', 'cursor-not-allowed')
    }
}

async function startSendingFile(fileName) {
    const file = state.sendingFiles.get(fileName)
    if (!file) return

    const idSafe = fileName.replace(/[^a-zA-Z0-9]/g, '')
    const progressContainer = document.getElementById(`progress-send-${idSafe}`)
    if (progressContainer) progressContainer.classList.remove('hidden')

    await sendFile(state.peer, file, (progress) => {
        if (progressContainer) {
            progressContainer.firstElementChild.style.width = `${progress}%`
        }
    })
}

function startReceivingFile(fileName, fileSize) {
    currentReceive = {
        fileName,
        fileSize,
        chunks: [],
        receivedSize: 0
    }

    const idSafe = fileName.replace(/[^a-zA-Z0-9]/g, '')
    const bar = document.getElementById(`progress-recv-${idSafe}`)
    if (bar) bar.classList.remove('hidden')
}

function handleFileChunk(chunk) {
    if (!currentReceive) return

    currentReceive.chunks.push(chunk)
    currentReceive.receivedSize += chunk.byteLength

    const progress = (currentReceive.receivedSize / currentReceive.fileSize) * 100

    const idSafe = currentReceive.fileName.replace(/[^a-zA-Z0-9]/g, '')
    const bar = document.querySelector(`#progress-recv-${idSafe} > div`)
    if (bar) {
        bar.style.width = `${progress}%`
    }
}

function completeFileReceive(fileName) {
    if (currentReceive && currentReceive.fileName === fileName) {
        const blob = new Blob(currentReceive.chunks)
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)

        const idSafe = fileName.replace(/[^a-zA-Z0-9]/g, '')
        const btn = document.getElementById(`btn-${idSafe}`)
        if (btn) {
            btn.textContent = '✓ Saved'
            btn.className = 'w-full py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg shadow-sm'
        }

        currentReceive = null
        showToast(`Downloaded ${fileName}`)
    }
}

// ------------------------------------------
// UI HELPERS
// ------------------------------------------

window.sendChatMessage = () => {
    const input = document.getElementById('chatInput')
    const text = input.value.trim()
    if (!text || !state.peer) return

    state.peer.send(JSON.stringify({ type: 'chat', text }))
    appendChat('You', text)
    input.value = ''
}

function appendChat(user, text) {
    const log = document.getElementById('chatLog')
    const isMe = user === 'You'

    const div = document.createElement('div')
    div.className = `flex w-full ${isMe ? 'justify-end' : 'justify-start'}`
    div.innerHTML = `
        <div class="max-w-[80%] px-4 py-2 rounded-xl text-sm ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}">
            ${text}
        </div>
    `
    log.appendChild(div)
    log.scrollTop = log.scrollHeight
}

function appendChatFile(sender, fileName, fileSize, status) {
    const log = document.getElementById('chatLog')
    const isMe = sender === 'me'
    const idSafe = fileName.replace(/[^a-zA-Z0-9]/g, '')

    let content = ''

    if (status === 'sent') {
        content = `
            <div class="flex items-center gap-3">
                <div class="bg-purple-100 p-2 rounded-lg text-purple-600">📄</div>
                <div>
                    <p class="font-medium truncate max-w-[150px]">${fileName}</p>
                    <p class="text-xs opacity-70">${formatBytes(fileSize)} • Ready to send</p>
                </div>
            </div>
            <div id="progress-send-${idSafe}" class="h-1 bg-white/20 mt-2 rounded-full overflow-hidden w-full hidden">
                <div class="h-full bg-white w-0 transition-all duration-200"></div>
            </div>
        `
    } else if (status === 'offer') {
        content = `
            <div class="flex items-center gap-3 mb-2">
                <div class="bg-indigo-100 p-2 rounded-lg text-indigo-600">⬇️</div>
                <div>
                    <p class="font-medium truncate max-w-[150px]">${fileName}</p>
                    <p class="text-xs text-gray-500">${formatBytes(fileSize)}</p>
                </div>
            </div>
            <button onclick="acceptFile('${fileName}')" id="btn-${idSafe}"
                class="w-full py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition shadow-sm">
                Download
            </button>
            <div id="progress-recv-${idSafe}" class="h-1 bg-gray-100 mt-2 rounded-full overflow-hidden w-full hidden">
                <div class="h-full bg-indigo-500 w-0 transition-all duration-200"></div>
            </div>
        `
    }

    const div = document.createElement('div')
    div.className = `flex w-full ${isMe ? 'justify-end' : 'justify-start'}`
    div.innerHTML = `
        <div class="max-w-[85%] p-3 rounded-xl ${isMe ? 'bg-purple-500 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}">
            ${content}
        </div>
    `
    log.appendChild(div)
    log.scrollTop = log.scrollHeight
}

// ------------------------------------------
// UTILITIES
// ------------------------------------------

function extractCode(input) {
    if (input.includes('/') || input.includes('://')) {
        const url = new URL(input.startsWith('http') ? input : window.location.origin + '/' + input)
        return url.pathname.split('/').pop() || url.hash.slice(1)
    }
    return input
}

function checkURLForCode() {
    const hash = window.location.hash.slice(1)
    if (hash && hash.length === 5) {
        document.getElementById('joinInput').value = hash // Pre-fill
        joinConnection() // Auto-join
        return true
    }
    return false
}

window.copyShareLink = () => {
    const input = document.getElementById('shareLink')
    input.select()
    document.execCommand('copy')
    showToast('Link copied!')
}

window.disconnect = () => {
    if (state.peer) {
        cleanup(state.peer)
    }
    state.peer = null
    state.isConnected = false
    state.connectionCode = ''
    switchView('landing')
    showToast('Disconnected')
    document.getElementById('headerStatus').classList.add('hidden')
    document.getElementById('chatLog').innerHTML = `<div class="flex justify-center my-4"><span class="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">⚡ Ready to Connect</span></div>`
}

function spinner(text) {
    return `
        <div class="bg-white border border-gray-100 rounded-xl p-6 text-center shadow-sm w-full max-w-sm mx-auto">
            <div class="animate-spin inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mb-3"></div>
            <p class="text-gray-700 font-medium text-lg">${text}</p>
        </div>
    `
}
