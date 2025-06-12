import AWS from 'aws-sdk';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config();

// ENV VARS: QUEUE_URL, BUCKET, OUTPUT_BUCKET, DB_HOST, DB_USER, DB_PASS, DB_NAME
console.log('SQS_URL:', process.env.SQS_URL);
const sqs = new AWS.SQS({ region: process.env.AWS_REGION });
const s3 = new AWS.S3({
  endpoint: 'http://host.docker.internal:4566',
  s3ForcePathStyle: true, // критично для LocalStack
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});



async function getMessages() {
  const resp = await sqs.receiveMessage({
    QueueUrl: process.env.SQS_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20
  }).promise();
  return resp.Messages || [];
}

async function deleteMessage(receiptHandle) {
  await sqs.deleteMessage({
    QueueUrl: process.env.SQS_URL,
    ReceiptHandle: receiptHandle
  }).promise();
}

async function resizeAndUpload(s3bucket, key, outBucket, outKey) {
  // Download image
  const imgResp = await s3.getObject({ Bucket: s3bucket, Key: key }).promise();
  const resized = await sharp(imgResp.Body).resize(512, 512).toBuffer();

  // Upload to output/
  await s3.putObject({ Bucket: outBucket, Key: outKey, Body: resized, ContentType: 'image/png' }).promise();
}

function randomText(len) {
  return randomBytes(len).toString('hex').slice(0, len);
}

function randomTags() {
  const tags = ['nature', 'city', 'car', 'cat', 'dog', 'fun', 'meme', 'cloud', 'ai', 'game', 'art', 'random'];
  return Array.from({length: 3}, () => tags[Math.floor(Math.random() * tags.length)]).join(',');
}

async function saveToDB(dbConfig, data) {
  const conn = await mysql.createConnection(dbConfig);

  // Перевірка і створення таблиці
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

  // Запис посту
  await conn.execute(
    'INSERT INTO posts (image_url, title, text, tags, created_at) VALUES (?, ?, ?, ?, NOW())',
    [data.url, data.title, data.text, data.tags]
  );

  await conn.end();
}


async function main() {
  try {
    const dbConfig = {
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    };

  console.log("🔧 DB config:", {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

    const inputBucket = process.env.S3_BUCKET;
    const outputBucket = process.env.OUTPUT_BUCKET || inputBucket;

    const messages = await getMessages();

    if (!messages || messages.length === 0) {
      console.log("No messages in queue.");
      return;
    }

    for (const msg of messages) {
      try {
        const payload = JSON.parse(msg.Body);
        const key = payload.detail.object.key;
        const base = key.split('/').pop();
        const outKey = `output/${base}`;

        await resizeAndUpload(inputBucket, key, outputBucket, outKey);

        const post = {
          url: `https://${outputBucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${outKey}`,
          title: "Post " + randomText(4),
          text: "Generated text: " + randomText(12),
          tags: randomTags()
        };

        await saveToDB(dbConfig, post);
        await deleteMessage(msg.ReceiptHandle);

        console.log("Processed:", post);
      } catch (err) {
        console.error("Error processing message:", err);
      }
    }
  } catch (e) {
    console.error("Fatal error:", e);
  } finally {
    process.exit(0); // Завершення процесу
  }
}

main();
