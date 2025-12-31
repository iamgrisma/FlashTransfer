// Main app state
const state = {
    peer: null,
    isHost: false,
    isConnected: false,
    connectionCode: '',
    selectedFiles: [],
    receivingFiles: new Map(),
    sendingFiles: new Map()
}

// Import modules
import { initP2P, createOffer, joinOffer, sendFile, cleanup } from './p2p.js'
import { createSession, getSession } from './api.js'
import { showToast, showStatus, hideStatus, formatBytes } from './utils.js'

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    setupEventListeners()
    checkURLForCode()
})

function setupEventListeners() {
    // File selection
    const fileInput = document.getElementById('fileInput')
    const fileInputFiles = document.getElementById('fileInputFiles')
    const dropzone = document.getElementById('dropzone')

    fileInput.addEventListener('change', handleFileSelection)
    fileInputFiles.addEventListener('change', handleFileSelection)

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropzone.classList.add('border-purple-500', 'bg-purple-50')
    })

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-purple-500', 'bg-purple-50')
    })

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault()
        dropzone.classList.remove('border-purple-500', 'bg-purple-50')

        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) {
            addFiles(files)
        }
    })
}

function handleFileSelection(e) {
    const files = Array.from(e.target.files)
    addFiles(files)
}

function addFiles(files) {
    state.selectedFiles.push(...files)
    updateFileList()
    document.getElementById('createBtn').disabled = false
}

function updateFileList() {
    const container = document.getElementById('selectedFiles')
    const list = document.getElementById('fileList')
    const count = document.getElementById('fileCount')

    if (state.selectedFiles.length === 0) {
        container.classList.add('hidden')
        return
    }

    container.classList.remove('hidden')
    count.textContent = state.selectedFiles.length

    list.innerHTML = state.selectedFiles.map((file, index) => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
            <span class="truncate flex-1">📄 ${file.name}</span>
            <span class="text-gray-500 text-xs ml-2">${formatBytes(file.size)}</span>
        </div>
    `).join('')
}

window.clearFiles = () => {
    state.selectedFiles = []
    updateFileList()
    document.getElementById('fileInput').value = ''
    document.getElementById('fileInputFiles').value = ''
    document.getElementById('createBtn').disabled = true
    document.getElementById('createBtn').disabled = true
}

window.handleAddMoreFiles = (input) => {
    const files = Array.from(input.files)
    if (files.length > 0) {
        state.selectedFiles.push(...files)

        // If connected, update UI and notify peer
        if (state.isConnected) {
            displaySendableFiles()
            sendFileList() // This sends the updated list to peer
            showToast(`Added ${files.length} files`)
        } else {
            // If not connected yet (rare case in this view but possible if disconnected)
            updateFileList()
        }
    }
    input.value = '' // Reset
}

// Create connection
window.createConnection = async () => {
    if (state.selectedFiles.length === 0) {
        showToast('Please select files first')
        return
    }

    showStatus('Creating connection...')

    try {
        const { code, peerId } = await createOffer(state.selectedFiles)
        state.connectionCode = code
        state.isHost = true

        // Setup peer
        state.peer = await initP2P(true, (peer) => {
            setupPeerListeners(peer)
        })

        // Wait for signal data
        const offer = await new Promise(resolve => state.peer.once('signal', resolve))

        // Send to server
        await createSession(offer, state.connectionCode)

        hideStatus()
        showStatus('Waiting for peer to join...<br>Share the code: ' + state.connectionCode)

        // Start polling for answer
        waitForAnswer(state.connectionCode)

    } catch (error) {
        hideStatus()
        showToast('Failed to create connection: ' + error.message)
        console.error(error)
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
                // We got an answer!
                clearInterval(pollInterval)
                showStatus('Connecting P2P...')
                const answer = JSON.parse(data.p2p_answer)
                state.peer.signal(answer)
            }
        } catch (e) {
            console.error('Polling error:', e)
        }
    }, 2000) // Poll every 2s
}

// Join connection
window.joinConnection = async () => {
    const input = document.getElementById('joinInput').value.trim()
    if (!input) {
        showToast('Please enter a code or link')
        return
    }

    // Extract code from URL or use as-is
    const code = extractCode(input)

    showStatus('Joining connection...')

    try {
        // Get offer from server
        const offerData = await getSession(code)

        // Setup peer
        state.peer = await initP2P(false, (peer) => {
            setupPeerListeners(peer)
        })

        // Join with offer
        await joinOffer(state.peer, offerData)

        state.connectionCode = code
        state.isHost = false

        // Join with offer
        await joinOffer(state.peer, offerData)

        state.connectionCode = code
        state.isHost = false

        hideStatus()
        showStatus('Connecting to peer...')
        // Connection will complete when peer.on('connect') fires

    } catch (error) {
        hideStatus()
        showToast('Failed to join: ' + error.message)
        console.error(error)
    }
}

function extractCode(input) {
    // If it's a URL, extract the code
    if (input.includes('/') || input.includes('://')) {
        const url = new URL(input.startsWith('http') ? input : window.location.origin + '/' + input)
        return url.pathname.split('/').pop() || url.hash.slice(1)
    }
    return input
}

function checkURLForCode() {
    const hash = window.location.hash.slice(1)
    const pathCode = window.location.pathname.split('/').pop()

    if (hash && hash.length === 5) {
        document.getElementById('joinInput').value = hash
        joinConnection() // Auto-join
    } else if (pathCode && pathCode.length === 5) {
        document.getElementById('joinInput').value = pathCode
        joinConnection() // Auto-join
    }
}

function setupPeerListeners(peer) {
    peer.on('connect', () => {
        state.isConnected = true
        showToast('✓ Connected!')

        // If host, send file list
        if (state.isHost) {
            sendFileList()
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
        // Try to parse as JSON (control messages)
        const message = JSON.parse(data.toString())

        switch (message.type) {
            case 'fileList':
                displayReceivableFiles(message.files)
                break
            case 'fileRequest':
                handleFileRequest(message.fileName)
                break
            case 'fileStart':
                startReceivingFile(message.fileName, message.fileSize)
                break
            case 'fileComplete':
                completeFileReceive(message.fileName)
                break
            case 'chat':
                appendChat('Peer', message.text, 'text-gray-800')
                break
            default:
                console.log('Unknown message type:', message.type)
        }
    } catch (e) {
        // Binary data - file chunk
        handleFileChunk(data)
    }
}

function sendFileList() {
    const fileList = state.selectedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
    }))

    state.peer.send(JSON.stringify({
        type: 'fileList',
        files: fileList
    }))

    // Display in send list
    displaySendableFiles()
}

function displaySendableFiles() {
    const list = document.getElementById('sendList')
    list.innerHTML = state.selectedFiles.map(file => `
        <div class="file-item p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex justify-between items-center mb-1">
                <span class="font-medium text-sm truncate">${file.name}</span>
                <span class="text-xs text-gray-500">${formatBytes(file.size)}</span>
            </div>
            <div id="send-${file.name}" class="text-xs text-gray-500">Ready to send</div>
        </div>
    `).join('')
}

function displayReceivableFiles(files) {
    const list = document.getElementById('receiveList')
    list.innerHTML = files.map(file => `
        <div class="file-item p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex justify-between items-center mb-2">
                <span class="font-medium text-sm truncate">${file.name}</span>
                <span class="text-xs text-gray-500">${formatBytes(file.size)}</span>
            </div>
            <button 
                onclick="requestFile('${file.name}')" 
                class="w-full py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
                Download
            </button>
            <div id="recv-${file.name}" class="mt-1"></div>
        </div>
    `).join('')
}

window.sendAllFiles = async () => {
    for (const file of state.selectedFiles) {
        await sendSingleFile(file)
    }
}

async function sendSingleFile(file) {
    const statusEl = document.getElementById(`send-${file.name}`)
    if (!statusEl) return

    statusEl.textContent = 'Sending...'

    try {
        await sendFile(state.peer, file, (progress) => {
            statusEl.innerHTML = `
                <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div class="bg-purple-600 h-2 rounded-full progress-bar" style="width: ${progress}%"></div>
                </div>
                <div class="text-xs mt-1">${Math.round(progress)}%</div>
            `
        })
        statusEl.textContent = '✓ Sent'
        statusEl.classList.add('text-green-600')
    } catch (error) {
        statusEl.textContent = '✗ Failed'
        statusEl.classList.add('text-red-600')
    }
}

window.requestFile = (fileName) => {
    state.peer.send(JSON.stringify({
        type: 'fileRequest',
        fileName
    }))
}

function handleFileRequest(fileName) {
    const file = state.selectedFiles.find(f => f.name === fileName)
    if (file) {
        sendSingleFile(file)
    }
}

let currentReceive = null

function startReceivingFile(fileName, fileSize) {
    currentReceive = {
        fileName,
        fileSize,
        chunks: [],
        receivedSize: 0
    }

    const statusEl = document.getElementById(`recv-${fileName}`)
    if (statusEl) {
        statusEl.innerHTML = 'Receiving...'
    }
}

function handleFileChunk(chunk) {
    if (!currentReceive) return

    currentReceive.chunks.push(chunk)
    currentReceive.receivedSize += chunk.byteLength

    const progress = (currentReceive.receivedSize / currentReceive.fileSize) * 100
    const statusEl = document.getElementById(`recv-${currentReceive.fileName}`)

    if (statusEl) {
        statusEl.innerHTML = `
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="text-xs mt-1">${Math.round(progress)}%</div>
        `
    }
}

function completeFileReceive(fileName) {
    if (currentReceive && currentReceive.fileName === fileName) {
        // Create blob and download
        const blob = new Blob(currentReceive.chunks)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)

        const statusEl = document.getElementById(`recv-${fileName}`)
        if (statusEl) {
            statusEl.innerHTML = '<span class="text-green-600">✓ Downloaded</span>'
        }

        currentReceive = null
        showToast(`Downloaded ${fileName}`)
    }
}

function showConnected() {
    document.getElementById('not-connected').classList.add('hidden')
    document.getElementById('connected').classList.remove('hidden')

    const shareLink = `${window.location.origin}/#${state.connectionCode}`
    document.getElementById('shareLink').value = shareLink
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

    document.getElementById('not-connected').classList.remove('hidden')
    document.getElementById('connected').classList.add('hidden')

    showToast('Disconnected')
}

window.sendChatMessage = () => {
    const input = document.getElementById('chatInput')
    const text = input.value.trim()
    if (!text || !state.peer) return

    state.peer.send(JSON.stringify({ type: 'chat', text }))
    appendChat('You', text, 'text-purple-600 font-medium')
    input.value = ''
}

function appendChat(user, text, classes) {
    const log = document.getElementById('chatLog')
    const div = document.createElement('div')
    div.innerHTML = `<span class="${classes}">${user}:</span> ${text}`
    log.appendChild(div)
    log.scrollTop = log.scrollHeight
}

// API calls moved to api.js
// async function sendOfferToServer...
// async function getOfferFromServer...
