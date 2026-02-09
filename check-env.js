require('dotenv').config({ path: '.env.local' });
console.log('DATABASE_URL is defined:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    console.log('DATABASE_URL starts with:', process.env.DATABASE_URL.substring(0, 10));
} else {
    console.log('Trying .env...');
    require('dotenv').config({ path: '.env' });
    console.log('DATABASE_URL from .env is defined:', !!process.env.DATABASE_URL);
}
