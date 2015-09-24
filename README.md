# dpratt/route53-presence


### Description

This docker image will register the private IP of an A record in an Amazon Route53 hosted zone. If there are existing entries
in the record, the IP will be appended to the list.

Additionally, the entry will be deregistered when the container exits.

### Usage

```
docker run \
  -e AWS_ACCESS_KEY_ID=... \
  -e AWS_SECRET_ACCESS_KEY=... \
  -e AWS_DEFAULT_REGION=... \
  -e ROUTE53_ZONE_ID=... \
  -e ROUTE53_DNS_NAME=... \
  dpratt/route53-presence
```

ROUTE53_ZONE_ID and ROUTE53_DNS_NAME are required, and the supplied amazon credentials will be used (if present). Otherwise the default credentials or the current
EC2 instance profile will be used.

### Example IAM Policy

```
{
   "Version": "2012-10-17",
   "Statement":[
      {
         "Effect":"Allow",
         "Action":[
           "route53:GetHostedZone", 
           "route53:ListResourceRecordSets",
           "route53:ChangeResourceRecordSets"
         ],
         "Resource":"arn:aws:route53:::hostedzone/Z148QEXAMPLE8V"
      },
      {
         "Effect":"Allow",
         "Action":[
           "route53:GetChange",
           "route53:ListHostedZones"
         ],
         "Resource":"*"
      }
   ]
}
```

