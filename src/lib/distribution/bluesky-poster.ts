import { BskyAgent, RichText } from '@atproto/api'

type BlueskyCredentials = {
    handle: string
    password: string // App Password
}

export type BroadcastPost = {
    text: string
    card?: {
        title: string
        description: string
        thumb?: string
        uri: string
    }
}

export class BlueskyPoster {
    private agent: BskyAgent

    constructor() {
        this.agent = new BskyAgent({ service: 'https://bsky.social' })
    }

    async login(creds: BlueskyCredentials) {
        await this.agent.login({
            identifier: creds.handle,
            password: creds.password
        })
    }

    async postThread(posts: BroadcastPost[]) {
        if (posts.length === 0) return

        let parent = null
        let root = null

        for (const post of posts) {
            // 1. Detect facets (links, mentions)
            const rt = new RichText({ text: post.text })
            await rt.detectFacets(this.agent)

            const postRecord: any = {
                text: rt.text,
                facets: rt.facets,
                createdAt: new Date().toISOString()
            }

            // 2. Add Reply Context (Threading)
            if (parent) {
                postRecord.reply = {
                    root: root,
                    parent: parent
                }
            }

            // 3. Add Embed Card (for Links)
            if (post.card) {
                // For simplicity, we are adding a simple external link embed
                // A full implementation would upload the thumbnail blob first
                postRecord.embed = {
                    $type: 'app.bsky.embed.external',
                    external: {
                        uri: post.card.uri,
                        title: post.card.title,
                        description: post.card.description,
                    }
                }
            }

            // 4. Send Post
            const res = await this.agent.post(postRecord)

            // 5. Update parent pointers for next post in thread
            parent = { uri: res.uri, cid: res.cid }
            if (!root) root = parent
        }

        return root
    }
}
