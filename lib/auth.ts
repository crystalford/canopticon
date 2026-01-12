import { currentUser } from "@clerk/nextjs/server";

export async function isUserAdmin(): Promise<boolean> {
    // DEBUG: Force Admin Mode
    return true;

    /* Original Logic disabled for debugging */
    /*
    const user = await currentUser();
    if (!user) return false;

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) return false;

    const adminEmailsEnv = process.env.ADMIN_EMAILS;

    // DEBUG LOGGING
    console.log(`[Auth Check] User: ${userEmail}`);

    // Default to Open Admin if no env var is set (for testing)
    if (!adminEmailsEnv || adminEmailsEnv.trim() === '') {
        console.log('[Auth Check] Open Admin Mode (No ADMIN_EMAILS set)');
        return true;
    }

    const adminEmails = adminEmailsEnv.split(',').map(e => e.trim());
    const isMatched = adminEmails.includes(userEmail);

    console.log(`[Auth Check] Admin List: ${adminEmails.join(', ')} | Match: ${isMatched}`);
    return isMatched;
    */
}
