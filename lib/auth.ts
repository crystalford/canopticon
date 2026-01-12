import { currentUser } from "@clerk/nextjs/server";

export async function isUserAdmin(): Promise<boolean> {
    const user = await currentUser();
    if (!user) return false;

    const adminEmailsEnv = process.env.ADMIN_EMAILS;

    // Default to Open Admin if no env var is set (for testing)
    if (!adminEmailsEnv || adminEmailsEnv.trim() === '') return true;

    const adminEmails = adminEmailsEnv.split(',');
    const userEmail = user.emailAddresses[0]?.emailAddress;

    if (!userEmail) return false;

    return adminEmails.includes(userEmail);
}
