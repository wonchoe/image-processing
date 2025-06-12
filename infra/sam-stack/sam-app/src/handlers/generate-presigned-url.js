const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client();
const ssm = new SSMClient();

exports.generatePresignedUrlHandler = async (event) => {
  try {
    const bucketParamName = process.env.BUCKET_PARAM || "/image-processing/storage-bucket";

    const ssmRes = await ssm.send(new GetParameterCommand({ Name: bucketParamName }));
    const bucketName = ssmRes.Parameter.Value;

    const requestBody = JSON.parse(event.body || '{}');
    const fileName = requestBody.fileName || `input/${Date.now()}-${Math.random().toString(36).substring(2,8)}.jpg`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ContentType: requestBody.contentType || "application/octet-stream"
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 900 });

    return {
      statusCode: 200,
      body: JSON.stringify({ uploadUrl: url, key: fileName }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // якщо потрібен CORS
      },
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
