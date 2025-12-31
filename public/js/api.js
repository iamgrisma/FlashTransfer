// centralized API logic
const BASE_URL = '/api'

export async function createSession(offer, code) {
    const response = await fetch(`${BASE_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer, code })
    })

    if (!response.ok) throw new Error('Failed to create session')
    return response.json()
}

export async function getSession(code) {
    const response = await fetch(`${BASE_URL}/join/${code}`)
    if (!response.ok) throw new Error('Session not found')
    return response.json()
}

export async function sendSignalAnswer(code, answer) {
    const response = await fetch(`${BASE_URL}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, answer })
    })

    if (!response.ok) throw new Error('Failed to send answer')
    return response.json()
}
