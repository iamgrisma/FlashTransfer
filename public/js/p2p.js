// P2P connection using simple-peer
// SimplePeer is loaded globally via index.html (window.SimplePeer)


export async function initP2P(initiator, onReady) {
    const peer = new SimplePeer({
        initiator,
        trickle: false,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    })

    peer.on('error', (err) => {
        console.error('Peer error:', err)
    })

    if (onReady) {
        peer.on('connect', () => onReady(peer))
    }

    return peer
}

export async function createOffer(files) {
    // Generate unique code
    const code = generateCode()
    const peerId = crypto.randomUUID()

    return { code, peerId }
}

export async function joinOffer(peer, offerData) {
    return new Promise((resolve, reject) => {
        peer.once('signal', (answer) => {
            // Send answer back through server
            sendAnswerToServer(offerData.code, answer)
                .then(resolve)
                .catch(reject)
        })

        // Signal with the offer
        peer.signal(offerData.offer)
    })
}

export async function sendFile(peer, file, onProgress) {
    return new Promise((resolve, reject) => {
        const CHUNK_SIZE = 64 * 1024 // 64KB chunks
        let offset = 0

        // Notify start
        peer.send(JSON.stringify({
            type: 'fileStart',
            fileName: file.name,
            fileSize: file.size
        }))

        const reader = new FileReader()

        reader.onload = (e) => {
            if (e.target.result) {
                peer.send(e.target.result)
                offset += e.target.result.byteLength

                onProgress((offset / file.size) * 100)

                if (offset < file.size) {
                    readNextChunk()
                } else {
                    // Notify complete
                    peer.send(JSON.stringify({
                        type: 'fileComplete',
                        fileName: file.name
                    }))
                    resolve()
                }
            }
        }

        reader.onerror = reject

        function readNextChunk() {
            const slice = file.slice(offset, offset + CHUNK_SIZE)
            reader.readAsArrayBuffer(slice)
        }

        readNextChunk()
    })
}

export function cleanup(peer) {
    if (peer && !peer.destroyed) {
        peer.destroy()
    }
}

function generateCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let code = ''
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

async function sendAnswerToServer(code, answer) {
    const { sendSignalAnswer } = await import('./api.js')
    return sendSignalAnswer(code, answer)
}
