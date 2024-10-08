const axios = require('axios');

exports.handler = async function ({ event: body, constants, triggers }, context, callback) {
    const token = constants.QTEST_TOKEN; // Replace with your qTest API token
    const qtestDomainName = constants.ManagerURL; // Replace with your qTest domain
    const apiUrl = `https://${qtestDomainName}/api/v3`; // Replace with your qTest API domain

    try {
        // Extract projectId and testRunId from the webhook payload
        const projectId = body.testlog.project_id;
        const testRunId = body.testlog.testrun_id;

        // 1. GET test run details
        const testRunResponse = await axios.get(`${apiUrl}/projects/${projectId}/test-runs/${testRunId}?includeToscaProperties=true`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const testRunData = testRunResponse.data;
        const toscaGuid = testRunData.tosca_guid;

        // If tosca_guid does not exist, log a message and stop processing
        if (!toscaGuid) {
            console.log('[INFO]: This is not a Tosca test result, stopping further processing.');
            return;
        }

        const parentId = testRunData.parentId;
        const parentType = testRunData.parentType;
        const testRunName = testRunData.name;

        // Search for the "Status" field in the properties array to get the field_value_name
        let testLogStatus = '';
        const statusProperty = testRunData.properties.find(prop => prop.field_name === 'Status');
        if (statusProperty) {
            testLogStatus = statusProperty.field_value_name;
        } else {
            console.error('[ERROR]: Status field not found in test run properties.');
            return;
        }

        // Determine the color for the test log status based on the result
        let statusColor;
        switch (testLogStatus) {
            case 'Passed':
                statusColor = 'Good'; // Green
                break;
            case 'Failed':
                statusColor = 'Attention'; // Red
                break;
            case 'Blocked':
            case 'Skipped':
                statusColor = 'Warning'; // Yellow
                break;
            default:
                statusColor = 'Default'; // Default color (black)
        }

        // 2. GET project details
        const projectResponse = await axios.get(`${apiUrl}/projects/${projectId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const projectName = projectResponse.data.name;

        // 3. If the parentType is a "test-suite", GET test suite details
        let testSuiteName = '';
        if (parentType === 'test-suite') {
            const testSuiteResponse = await axios.get(`${apiUrl}/projects/${projectId}/test-suites/${parentId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            testSuiteName = testSuiteResponse.data.name;
        } else {
            console.error('[ERROR]: Parent is not a test-suite.');
            return;
        }

        // 4. Construct the message
        const message = `Tosca Results Submitted: ${projectName} - ${testSuiteName} - ${testRunName} - ${testLogStatus}`;

        // 5. Create a URL for the test run in qTest
        const testRunUrl = `https://${qtestDomainName}/p/${projectId}/portal/project#id=${testRunId}&object=3&tab=testexecution`;

        // 6. Format and send an Adaptive Card to Teams with conditional color for test status and footer hyperlink
        const response = await axios.post(constants.TeamsWebhook, {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.2",
                        "body": [
                            {
                                "type": "TextBlock",
                                "size": "Medium",
                                "weight": "Bolder",
                                "text": "Tosca Results Submitted"
                            },
                            {
                                "type": "FactSet",
                                "facts": [
                                    {
                                        "title": "Project Name:",
                                        "value": projectName
                                    },
                                    {
                                        "title": "Test Suite Name:",
                                        "value": testSuiteName
                                    },
                                    {
                                        "title": "Test Run Name:",
                                        "value": testRunName
                                    },
                                    {
                                        "title": "Test Log Status:",
                                        "value": testLogStatus,
                                        "color": statusColor // Color based on test log status
                                    }
                                ]
                            },
                            {
                                "type": "TextBlock",
                                "text": `[Click here to view the Test Run in qTest](${testRunUrl})`,
                                "wrap": true,
                                "spacing": "Medium"
                            }
                        ]
                    }
                }
            ]
        });

        console.log(`[INFO]: statusCode: ${response.status}`);
        
    } catch (error) {
        console.error('[ERROR]: Error occurred during execution:', error.message);
    }
};
