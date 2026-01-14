
import fetch from 'node-fetch'

async function debug() {
    console.log('Fetching recent bills...')
    const res = await fetch('https://api.openparliament.ca/bills/?limit=5&format=json', {
        headers: { 'User-Agent': 'CANOPTICON/1.0' }
    })
    const data = await res.json()
    const bills = data.objects || []

    for (const bill of bills) {
        console.log(`\nBill: ${bill.number} - ${bill.name?.en || bill.name}`)
        console.log(`Text URL: ${bill.text_url}`)

        if (bill.text_url) {
            console.log('Fetching text...')
            const textRes = await fetch(bill.text_url)
            const raw = await textRes.text()
            console.log(`Raw length: ${raw.length}`)
            const clean = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            console.log(`Clean snip: ${clean.slice(0, 200)}`)
        } else {
            console.log('No text_url provided by API')
        }
    }
}

debug()
