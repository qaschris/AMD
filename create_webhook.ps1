# Define the API endpoint and headers
$apiUrl = "https://amd.qtestnet.com/api/v3/webhooks"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer <Your_API_Token>"  # Replace with your actual API token
}

# Define the payload
$body = @{
    name = "qTest Teams Notification"
    url = "string"
    events = @("testlog_submitted")
    secretKey = "NA"
    responseType = "json"
    projectIds = @(133370)
} | ConvertTo-Json

# Make the API call
$response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body

# Output the response
$response