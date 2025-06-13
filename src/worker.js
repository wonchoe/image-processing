import AWS from 'aws-sdk';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config();

console.log("✅ Container started at the very beginning");

process.on('unhandledRejection', (reason) => {
  console.error('🧨 Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err);
});

const s3 = new AWS.S3({ region: process.env.AWS_REGION });

function randomText(len) {
  return randomBytes(len).toString('hex').slice(0, len);
}

function randomTags() {
  const tags = ['nature', 'city', 'car', 'cat', 'dog', 'fun', 'meme', 'cloud', 'ai', 'game', 'art', 'random'];
  return Array.from({ length: 3 }, () => tags[Math.floor(Math.random() * tags.length)]).join(',');
}

async function resizeAndUpload(s3bucket, key, outBucket, outKey) {
  console.log("📤 S3 image download started:", { bucket: s3bucket, key });
  const imgResp = await s3.getObject({ Bucket: s3bucket, Key: key }).promise();

  console.log("📐 Image resizing...");
  const resized = await sharp(imgResp.Body).resize(512, 512).toBuffer();
  console.log("📐 Image resized");

  console.log("📤 Uploading resized image:", { bucket: outBucket, key: outKey });
  await s3.putObject({ Bucket: outBucket, Key: outKey, Body: resized, ContentType: 'image/png' }).promise();
  console.log("📤 Image uploaded to S3");
}

async function saveToDB(dbConfig, data) {
  console.log("💾 Connecting to DB...");
  const conn = await mysql.createConnection(dbConfig);

  console.log("📊 Ensuring DB + table exists...");
  await conn.query("CREATE DATABASE IF NOT EXISTS imageprocessing");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image_url VARCHAR(255),
      title VARCHAR(100),
      text TEXT,
      tags VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("📝 Inserting post into DB:", data);
  await conn.execute(
    'INSERT INTO posts (image_url, title, text, tags, created_at) VALUES (?, ?, ?, ?, NOW())',
    [data.url, data.title, data.text, data.tags]
  );

  await conn.end();
  console.log("📩 Post inserted and DB connection closed");
}

async function main() {
  console.log("🔧 ENVIRONMENT LOADED");
  console.log("S3_BUCKET:", process.env.S3_BUCKET);
  console.log("INPUT_KEY:", process.env.INPUT_KEY);
  console.log("REGION:", process.env.AWS_REGION);

  try {
    const dbConfig = {
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    };

    console.log("🔧 DB config:", dbConfig);

    const inputBucket = process.env.S3_BUCKET;
    const key = process.env.INPUT_KEY;
    const outputBucket = process.env.OUTPUT_BUCKET || inputBucket;
    const outKey = `output/${key.split('/').pop()}`;

    console.log("📦 Payload parsed:", { key, outKey });

    await resizeAndUpload(inputBucket, key, outputBucket, outKey);

    const post = {
      url: `https://${outputBucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${outKey}`,
      title: "Post " + randomText(4),
      text: "Generated text: " + randomText(12),
      tags: randomTags()
    };

    await saveToDB(dbConfig, post);

    console.log("✅ Processed:", post);
  } catch (e) {
    console.error("💥 Fatal error:", e);
  } finally {
    console.log("⏹ Task finished. Exiting...");
    await new Promise((res) => setTimeout(res, 3000));
    process.exit(0);
  }
}

main();
