
import fetch from 'node-fetch'

async function debugFilter() {
    console.log('Fetching bills without filter (default)...')
    const res1 = await fetch('https://api.openparliament.ca/bills/?limit=1&format=json')
    const data1 = await res1.json()
    console.log(`Default Top 1: ${data1.objects[0]?.introduced} - ${data1.objects[0]?.number}`)

    console.log('\nFetching bills with session=44-1...')
    const res2 = await fetch('https://api.openparliament.ca/bills/?limit=1&format=json&session=44-1')
    const data2 = await res2.json()
    console.log(`Filtered Top 1: ${data2.objects[0]?.introduced} - ${data2.objects[0]?.number}`)
}

debugFilter()
