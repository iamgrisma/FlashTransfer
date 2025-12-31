// Utility functions

export function showToast(message) {
    const toast = document.getElementById('toast')
    const toastText = document.getElementById('toastText')

    toastText.textContent = message
    toast.classList.remove('hidden')

    setTimeout(() => {
        toast.classList.add('hidden')
    }, 3000)
}

export function showStatus(message) {
    const status = document.getElementById('status')
    const statusText = document.getElementById('statusText')

    statusText.textContent = message
    status.classList.remove('hidden')
}

export function hideStatus() {
    document.getElementById('status').classList.add('hidden')
}

export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
