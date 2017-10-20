if (CC_JSB) {
    module.exports = function (item, callback) {
        var url = item.url;

        var result = jsb.fileUtils.getStringFromFile(url);
        if (typeof result === 'string' && result) {
            callback(null, result);
        }
        else {
            callback(new Error('Download text failed: ' + url));
        }
    };
}
else {
    var urlAppendTimestamp = require('./utils').urlAppendTimestamp;

    module.exports = function (item, callback) {
        var url = item.url,
            xhr = cc.loader.getXMLHttpRequest(),
            errInfo = 'Load ' + url + ' failed!',
            navigator = window.navigator;

        url = urlAppendTimestamp(url);

        xhr.open('GET', url, true);
        if (/msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)) {
            // IE-specific logic here
            xhr.setRequestHeader('Accept-Charset', 'utf-8');
            xhr.onreadystatechange = function () {
                if(xhr.readyState === 4) {
                    if (xhr.status === 200 || xhr.status === 0) {
                        callback(null, xhr.responseText);
                    }
                    else {
                        callback({status:xhr.status, errorMessage:errInfo});
                    }
                }
            };
        } else {
            if (xhr.overrideMimeType) xhr.overrideMimeType('text\/plain; charset=utf-8');
            xhr.onload = function () {
                if(xhr.readyState === 4) {
                    if (xhr.status === 200 || xhr.status === 0) {
                        callback(null, xhr.responseText);
                    }
                    else {
                        console.error('xhr ready state is wrong: ', xhr.status);
                        cc.game.emit('xhr-load-error', errInfo);
                        callback({status:xhr.status, errorMessage:errInfo});
                    }
                }
            };
            xhr.onerror = function(){
                console.error('xhr onerror called ' + xhr.status + ' Detail: ' + errInfo);
                cc.game.emit('xhr-load-error', errInfo);
                callback({status:xhr.status, errorMessage:errInfo});
            };
        }
        xhr.send(null);
    };
}
