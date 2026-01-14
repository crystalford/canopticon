
import fetch from 'node-fetch'

async function debugSort() {
    console.log('Testing sort parameters...')

    // Attempt 1: ordering=-introduced (Django REST default)
    const url1 = 'https://api.openparliament.ca/bills/?limit=1&format=json&ordering=-introduced'
    const res1 = await fetch(url1)
    const data1 = await res1.json()
    console.log(`ordering=-introduced: ${data1.objects[0]?.introduced} (Bill ${data1.objects[0]?.number})`)

    // Attempt 2: sort=date
    const url2 = 'https://api.openparliament.ca/bills/?limit=1&format=json&sort=date'
    const res2 = await fetch(url2)
    const data2 = await res2.json()
    console.log(`sort=date: ${data2.objects[0]?.introduced} (Bill ${data2.objects[0]?.number})`)
}

debugSort()
