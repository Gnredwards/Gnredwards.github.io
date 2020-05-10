window.authUtilities = {
    setConstants: function () {
        window.easyAuthInfo = null;
        window.functionAppBaseUrl = 'https://mapmytimeauth.azurewebsites.net/';
    },
    clearEasyAuth: function (provider) {
        if (easyAuthInfo === null) {
            return; // no info to clear
        }
        if (easyAuthInfo.provider === provider) {
            easyAuthInfo = null;
        }
        // else - not currently logged in with the specified provider
    },
    getEasyAuthToken: function () {
        return easyAuthInfo === null ? null : easyAuthInfo.token;
    },

    //var logElement = document.getElementById('log');
    clearLog: function () {
        //To do this will need to be done differently
        //logElement.innerText = '';
    },
    log: function log(message) {
        alert(message);
    },
    translateAuthToken: function (provider, body) {
        // Call function app to translate provider token to easyAuthInfo
        this.sendRequest(
            {
                method: 'POST',
                url: `${functionAppBaseUrl}.auth/login/${provider}`,
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                },
                body: body
            },
            function () {
                log(`EasyAuth response (${provider}): ${this.responseText}`);
                var easyAuthResponse = JSON.parse(this.responseText);
                easyAuthInfo =
                    {
                        provider: provider,
                        token: easyAuthResponse.authenticationToken,
                    };
            }
        );
    },

    callIsAuthenticated: function () {
        window.authUtilities.sendRequest(
            {
                method: 'GET',
                url: `${functionAppBaseUrl}api/IsAuthenticated`,
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'X-ZUMO-AUTH': window.authUtilities.getEasyAuthToken()
                },
            },
            function () {
                window.authUtilities.log(`Response from IsAuthenticated: ${this.responseText}`);
            }
        );
    },
    callGetClaims: function () {
        sendRequest(
            {
                method: 'GET',
                url: `${functionAppBaseUrl}api/GetClaims`,
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'X-ZUMO-AUTH': getEasyAuthToken()
                },
            },
            function () {
                log(`Response from GetClaims: ${this.responseText}`);
            }
        );
    },
    callGetAuthInfo: function () {
        sendRequest(
            {
                method: 'GET',
                url: `${functionAppBaseUrl}api/GetAuthInfo`,
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'X-ZUMO-AUTH': getEasyAuthToken()
                },
            },
            function () {
                log(`Response from GetAuthInfo: ${this.responseText}`);
            }
        );
    },
    callGetEmail: function () {
        sendRequest(
            {
                method: 'GET',
                url: `${functionAppBaseUrl}api/GetEmailClaim`,
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'X-ZUMO-AUTH': getEasyAuthToken()
                },
            },
            function () {
                log(`Response from GetEmail: ${this.responseText}`);
            }
        );
    },
    callAuthMe: async function () {

        let myval = await window.authUtilities.getAsync(window.functionAppBaseUrl + ".auth/me", 
            {
                    'accept': 'application/json',
                    'content-type': 'application/json'
                    //'X-ZUMO-AUTH': window.authUtilities.getEasyAuthToken()
                });
            
        return myval;

    },
    // callAuthMe: function () {
    //     var responsetext;
    //     sendRequest(
    //         {
    //             method: 'GET',
    //             url: `${functionAppBaseUrl}.auth/me`,
    //             headers: {
    //                 'accept': 'application/json',
    //                 'content-type': 'application/json',
    //                 'X-ZUMO-AUTH': getEasyAuthToken()
    //             },
    //         },
    //         function () {
    //             responsetext = this.responseText;
    //         }
    //     );
    // },
    callAuthLogout: function () {
        sendRequest(
            {
                method: 'GET',
                url: `${functionAppBaseUrl}.auth/logout`,
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'X-ZUMO-AUTH': getEasyAuthToken()
                },
            },
            function () {
                log('called .auth/logout');
            }
        );
    },
    getAsync: async function(url, headers){
        var data;
        let response = await fetch(url,{headers});
        if (response.ok){
            data = await response.json();
        }
        else{
            data = await response.status;
        }
        return data;
    },
    sendRequest: function (options, handler) {
        var xhr = new XMLHttpRequest();
        xhr.open(options.method, options.url);
        for (header in options.headers) {
            xhr.setRequestHeader(header, options.headers[header]);
        }
        xhr.onload = handler
        var body = options.body;
        if (body !== undefined && body !== null && typeof (body) !== 'string') {
            body = JSON.stringify(body);
        }
        xhr.send(body);
        return xhr.responseText;
    }
}
// document.getElementById('clearLog').addEventListener('click', clearLog);
// document.getElementById('testIsAuthenticated').addEventListener('click', callIsAuthenticated);
// document.getElementById('getClaims').addEventListener('click', callGetClaims);
// document.getElementById('getAuthInfo').addEventListener('click', callGetAuthInfo);
// document.getElementById('getEmail').addEventListener('click', callGetEmail);
// document.getElementById('callAuthMe').addEventListener('click', callAuthMe);
// document.getElementById('callAuthLogout').addEventListener('click', callAuthLogout);
