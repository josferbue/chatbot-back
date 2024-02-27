const dotenv = require("dotenv").config()

var cors = require('cors')

const express = require("express")

const dialogflow = require("@google-cloud/dialogflow")

const uuid = require('uuid');

const { BigQuery } = require('@google-cloud/bigquery');

const { deserializeGoogleStructValue } = require("./struct.js");

const DLP = require('@google-cloud/dlp');

const dlp = new DLP.DlpServiceClient();

const PORT = process.env.PORT || 7000



const projectId = process.env.PROJECT_ID || "jafernandez-tfm"
const credentialsPath = process.env.CREDENTIALS_PATH || "./jafernandez-tfm-65c13c5c17dd.json"

process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath


async function deIdentifyRedaction(message) {
    const infoTypes = [{ name: 'PHONE_NUMBER' }, { name: 'PERSON_NAME' }, { name: 'EMAIL_ADDRESS' }];
    // Construct deidentify configuration
    const deidentifyConfig = {
        infoTypeTransformations: {
            transformations: [
                {
                    infoTypes: infoTypes,
                    primitiveTransformation: {
                        redactConfig: {},
                    },
                },
            ],
        },
    };

    // Construct inspect configuration
    const inspectConfig = {
        infoTypes: infoTypes,
    };

    // Construct Item
    const item = {
        value: message,
    };

    // Combine configurations into a request for the service.
    const request = {
        parent: `projects/${projectId}/locations/global`,
        item,
        deidentifyConfig,
        inspectConfig,
    };

    // Send the request and receive response from the service
    const [response] = await dlp.deidentifyContent(request);

    // Print the results
    return response.item.value;
}

const options = {
    keyFilename: credentialsPath,
    projectId: projectId,
};

const bigquery = new BigQuery(options);

async function insertDataBigQuery(data) {
    const datasetId = "tintatoner";
    const tableId = "chatbot";
    const rows = [
        { sessionId: data.sessionId, userMessage: await deIdentifyRedaction(data.userMessage), botMessage: data.botMessage, intentDetectionConfidence: data.intentDetectionConfidence },
    ];

    // Insert data into a table
    bigquery.dataset(datasetId).table(tableId).insert(rows);

}

async function sendMessage(sessionId, message) {


    // Create a new session
    const sessionClient = new dialogflow.SessionsClient();
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    // The text query request.
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                // The query to send to the dialogflow agent
                text: message,
                // The language used by the client (en-US)
                languageCode: 'es-ES',
            },
        },
    };

    return generateResponse(sessionId, await sessionClient.detectIntent(request));

}

function enrichResponse(response, queryResult) {
    let type = "simple";
    queryResult.outputContexts.forEach((context) => {
        if (context.parameters != null && context.parameters.fields != null) {
            if (context.parameters.fields.models) {
                response.models = deserializeGoogleStructValue(context.parameters).models;
                if (response.models.length == 0) {
                    type = "avanceSearch";
                    console.log(queryResult.parameters);
                    response.model = deserializeGoogleStructValue(queryResult.parameters).Model;
                } else {
                    type = "models";
                }
            }
            if (context.parameters.fields.message) {
                const message = deserializeGoogleStructValue(context.parameters).message;
                if (message != null && message != "") {
                    response.bot = message;
                }
            }

        }

    });
    response.type = type;
    return response;
}

function generateResponse(sessionId, responses) {
    const result = responses[0].queryResult.fulfillmentText;
    if (!result) {
        return Error("No intent matched")
    }
    const queryText = responses[0].queryResult.queryText;
    const intentDetectionConfidence = responses[0].queryResult.intentDetectionConfidence;

    insertDataBigQuery({ sessionId: sessionId, userMessage: queryText, botMessage: result, intentDetectionConfidence: intentDetectionConfidence });

    return enrichResponse({
        sessionId: sessionId,
        user: queryText,
        bot: result
    }, responses[0].queryResult);

}

const app = express()

app.use(cors())

app.get("/", async (req, res) => {
    try {
        var sessionId = req.query.sessionId;
        if (sessionId == null) {
            // A unique identifier for the given session
            sessionId = uuid.v4();
        }
        var message = req.query.message;
        if (message == null) {
            return res.status(403).json({ message: "Parameter message is required" })
        }

        const result = await sendMessage(sessionId, message)
        return res.status(200).json({ message: "Success", result })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Server error", error })
    }
})

const start = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`Server has been started on port ${PORT}`)
        })
    } catch (error) {
        console.log(error)
    }
}

start()
