# Authentication

The SimpleAnnotationServer now supports Authentication through OAuth. This allows users to login using Google, GitHub or other OAuth provider and to work on a private workspace of Annotations, Manifests and Collections. 

## Configuration

The presence of a file called `auth.json` in the `src/main/webapp/WEB-INF` is enough for SAS to know that it should use authentication for all requests. The `auth.json` file has settings for OAuth providers and should be kept secret and outside of GitHub. An example configuration for Google is shown below:

```
[{
    "id":"google",
    "class": "com.github.scribejava.apis.GoogleApi20",
    "clientId": "**google_client_id**",
    "clientSecret": "**google_client_secret",
    "scope": "profile email",
    "additionalParam": {
        "access_type": "offline"    
    },
    "button": {
        "logo": "/images/GoogleLogo.svg",
        "text": "Sign in with Google"
    },
    "userMapping": {
        "endpoint": "https://www.googleapis.com/oauth2/v3/userinfo",
        "responseKeys": {
            "id":"sub",
            "name": "name",
            "email": "email",
            "pic": "picture"
        }
    }
}]
```

The file is split into three sections; OAuth settings, button config and userMappings and details for each section can be seen below. To offer multiple login options it is possible to add extra configs to this file as the root of the JSON is a list. 

### OAuth Settings

The OAuth settings from above are copied below for convenience: 

```
"id":"google",
"class": "com.github.scribejava.apis.GoogleApi20",
"clientId": "**google_client_id**",
"clientSecret": "**google_client_secret",
"scope": "profile email",
"additionalParam": {
    "access_type": "offline"    
},
```

The files are:

 * __id__ this should be unique in the file and be used to identify the authentication method
 * __class__ this is the [ScribeJava](https://github.com/scribejava/scribejava) OAuth library class which implements this authentication method. The ScribeJava github site gives examples with lots of different OAuth providers. 
 * __clientId__ and __clientSecret__ these are generated by Google and you can apply for a set of keys by going to the [Google Developer Console](https://console.developers.google.com/apis/credentials). When you apply for keys you will need to add a Authorized redirect URI to the SAS system. This is the URL google will return the user if they authenticated correctly. The redirect URI should be:

https://example.com/login-callback

where example.com is the public domain name you are using to host SAS.

 * __scope__ this is the information SAS is asking the user to give permission for. To find out what is required for your OAuth provider check the ScribeJava examples.
 * __additionalParam__ some OAuth providers also require extra parameters. Again check ScribeJava to see if this is required. 

### Button config
When you login to SAS it will present you with a login page where users are asked to choose which login service they would like to register with. The button config allows customisation of the logo and text that is offered to the user for this authentication method:

```
"button": {
    "logo": "/images/GoogleLogo.svg",
    "text": "Sign in with Google"
},
```

### User Mapping
Once a user has been authenticated then SAS will request the name, email and profile picture from the OAuth provider. This is usually done using a standard API that returns a JSON list of keys. The Key mapping configuration maps the OAuth User JSON to SAS's users. 

```
"userMapping": {
    "endpoint": "https://www.googleapis.com/oauth2/v3/userinfo",
    "responseKeys": {
        "id":"sub",
        "name": "name",
        "email": "email",
        "pic": "picture"
    }
}
```

## Extra customisation

As well as the general configuration above its also possible to customise the authentication in the following ways.



## Deployment with Docker

If you are working with SAS in the cloud you will need to make sure the that the auth.json doesn't end up in GitHub where it will be public. There is an example [Dockerfile](../docker/sas-auth/Dockerfile) in the sas-auth directory which will work with a `auth.json` held in an Amazon S3 bucket. To get this to work you will need to ensure the Code Pipeline role has the following permissions:


Codepipeline Service role to access s3:

Build project -> build details -> Service role ARN

Ensure ROLE has this:
```
{
    "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:GetBucketVersioning"
    ],
    "Resource": [
        "arn:aws:s3:::sasconfig*"
    ],
    "Effect": "Allow"
},
{
    "Effect": "Allow",
    "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:GenerateDataKeyWithoutPlaintext",
        "kms:GenerateDataKeyPairWithoutPlaintext",
        "ssm:GetParameters",
        "kms:GenerateDataKeyPair",
        "ssm:GetParameter"
    ],
    "Resource": [
        "arn:aws:kms:$REGION:$AWS_ACCOUNT_ID:key/$ENCRYPT_KEY",
        "arn:aws:ssm:$REGION:$AWS_ACCOUNT_ID:parameter/$PARAM_KEYS/*"
    ]
}
```

To find the relevant service role you can navigate to your Code Builder project where you can see the history of your build. At the top there is a tab called 'Build Details'. Click this then scroll down until you see a clickable link for the "Service role".

For your configuration you to will need to change `$REGION`, `$AWS_ACCOUNT_ID`, `$ENCRYPT_KEY` and $PARAM_KEYS to fit your AWS account details. To setup the required parameters there is a great write up here:

https://medium.com/rockedscience/fixing-docker-hub-rate-limiting-errors-in-ci-cd-pipelines-ea3c80017acb

## Migrating from previous versions of SAS
SAS previously hasn't had the concept of users or Authentication so this version will be a breaking change and any annotations created using previous versions of SAS will no longer be accessible because they are not associated with a user. Ensure you have backed up any annotations you would like to keep and it is advisable to use a new ElasticSearch or SOLR index to run this version of SAS.