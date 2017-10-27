function downloadResFromRemote (url, callback) {
    var xhr = cc.loader.getXMLHttpRequest(),
        errInfo = 'Load ' + url + ' failed!',
        navigator = window.navigator;

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
}

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
        var url = item.url;

        url = urlAppendTimestamp(url);

        if (cc._isWechatGame()) {
            var fs = wx.getFileSystemManager();
            var ccfs = require('./wegame-fs');
            var assetPrefix = cc.AssetLibrary._assetsPrefix;
            //只有在cdn的资源才需要在本地缓存，因为我们做了md5
            //如果是其他资源：比如人物头像等，则不需要缓存
            if (url.startsWith(assetPrefix)) {
                var filePath = url.substring(assetPrefix.length);
                var localPath = wx.env.USER_DATA_PATH + '/' + filePath;
                try {
                    fs.accessSync(localPath);
                    fs.readFile({
                        filePath: localPath,
                        encoding: 'utf8',
                        success: function (res) {
                            if (res.data) {
                                console.error('read file success')!
                                callback(null, res.data);
                            }
                        },
                        fail: function (res) {
                            if (res.errMsg) {
                                console.error('read file failed')!
                                cc.game.emit('xhr-load-error:', res.errMsg);
                                callback({status:0, errorMessage: res.errMsg});
                            }
                        }
                    });
                } catch (e) {
                    wx.downloadFile({
                        url: url,
                        fail: function (res) {
                            if (res.errMsg) {
                                cc.game.emit('xhr-load-error:', res.errMsg);
                                console.error('download file error!');
                                callback({status:0, errorMessage: res.errMsg});
                            }
                        },
                        success: function(res) {
                            fs.readFile({
                                filePath: res.tempFilePath,
                                encoding: 'utf8',
                                success: function (res) {
                                    if (res.data) {
                                        console.error('download file success');
                                        callback(null, res.data);
                                    }
                                    //use async version
                                    ccfs.writeFileAsync(localPath, res.data, 'utf8', function () {
                                        console.log('write file ' + localPath + ' successfully!');
                                        // fs.unlink({filePath: res.tempFilePath});
                                    });
                                }
                            });
                        }
                    })
                }
            } else {
                downloadResFromRemote(url, callback);
            }
        } else {
            downloadResFromRemote(url, callback);
        }

    };
}
