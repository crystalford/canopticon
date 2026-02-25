import { Innertube } from 'youtubei.js';

async function test() {
    try {
        const yt = await Innertube.create();

        console.log("Fetching transcript for: jNQXAC9IVRw");
        const info1 = await yt.getInfo('jNQXAC9IVRw');
        const transcript1 = await info1.getTranscript();
        console.log("Success! Segments:", transcript1?.transcript?.content?.body?.initial_segments?.length || 0);

        console.log("\nFetching transcript for: zSCls651Z-8");
        const info2 = await yt.getInfo('zSCls651Z-8');
        const transcript2 = await info2.getTranscript();
        console.log("Success! Segments:", transcript2?.transcript?.content?.body?.initial_segments?.length || 0);

    } catch (e: any) {
        console.error("Failed:", e.message);
    }
}
test();
