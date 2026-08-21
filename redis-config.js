import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT || 6379);

if (!Number.isInteger(redisPort) || redisPort <= 0) {
    throw new Error('REDIS_PORT must be a valid positive integer');
}

export const redisConnection = {
    host: redisHost,
    port: redisPort
};