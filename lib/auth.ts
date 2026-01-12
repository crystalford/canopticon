import { currentUser } from "@clerk/nextjs/server";

export async function isUserAdmin(): Promise<boolean> {
    const user = await currentUser();
    if (!user) return false;

    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const userEmail = user.emailAddresses[0]?.emailAddress;

    if (!userEmail) return false;

    return adminEmails.includes(userEmail);
}
