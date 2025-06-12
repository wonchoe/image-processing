import {
  SSMClient,
  GetParameterCommand
} from "@aws-sdk/client-ssm";
import {
  ECSClient,
  RunTaskCommand
} from "@aws-sdk/client-ecs";

export const handler = async (event) => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const ssm = new SSMClient({ region });
  const ecs = new ECSClient({ region });

  const paramKeys = [
    '/image-processing/ecs-cluster',
    '/image-processing/task-definition',
    '/image-processing/subnet-ids'
  ];

  const ssmValues = {};
  for (const key of paramKeys) {
    const response = await ssm.send(new GetParameterCommand({ Name: key }));
    ssmValues[key] = response.Parameter?.Value;
  }

  const message = event.Records[0];
  const payload = JSON.parse(message.body);
  const key = payload.detail.object.key;
  const bucket = payload.detail.bucket.name;

  const env = [
    { name: "S3_BUCKET", value: bucket },
    { name: "INPUT_KEY", value: key },
    { name: "AWS_REGION", value: region },
    { name: "SQS_URL", value: process.env.MAIN_QUEUE_URL || "" }
  ];

  const runTask = await ecs.send(new RunTaskCommand({
    cluster: ssmValues['/image-processing/ecs-cluster'],
    taskDefinition: ssmValues['/image-processing/task-definition'],
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ssmValues['/image-processing/subnet-ids'].split(','),
        assignPublicIp: "ENABLED"
      }
    },
    overrides: {
      containerOverrides: [
        {
          name: "worker",
          environment: env
        }
      ]
    }
  }));

  console.log("Task started:", runTask.tasks?.[0]?.taskArn);

  return {
    statusCode: 200,
    body: JSON.stringify({ task: runTask.tasks?.[0]?.taskArn })
  };
};


//