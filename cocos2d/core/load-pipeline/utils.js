// var AssetLibrary = require('../platform/CCAssetLibrary.js');

module.exports = {
    //isUrlCrossOrigin: function (url) {
    //    if (!url) {
    //        cc.log('invalid URL');
    //        return false;
    //    }
    //    var startIndex = url.indexOf('://');
    //    if (startIndex === -1)
    //        return false;
    //
    //    var endIndex = url.indexOf('/', startIndex + 3);
    //    var urlOrigin = (endIndex === -1) ? url : url.substring(0, endIndex);
    //    return urlOrigin !== location.origin;
    //},
    urlAppendTimestamp: function (url) {
        var key = url.split(cc.AssetLibrary._assetsPrefix)[1];
        var realUrl = cc.AssetLibrary._urlMapping[key];
        if (realUrl ) {
            url = cc.AssetLibrary._assetsPrefix + realUrl;
        } else {
            console.log(url);
        }
        return url;
    }
};
