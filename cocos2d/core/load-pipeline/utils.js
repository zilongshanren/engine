// var AssetLibrary = require('../platform/CCAssetLibrary.js');
var ExtnameRegex = /(\.[^.\n\\/]*)$/;

cc.md5Pipe = module.exports = {
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
        var libraryBase = cc.AssetLibrary._libraryBase;
        var rawAssetsBase = cc.AssetLibrary._rawAssetsBase;

        var index = url.indexOf('?');
        var key = url;
        if (index !== -1) {
            key = url.substr(0, index);
        }
        if (key.startsWith(libraryBase)) {
            key = key.slice(libraryBase.length);
        } else if(key.startsWith(rawAssetsBase)) {
            key = key.slice(rawAssetsBase.length);
        } else {
            return url;
        }
        var hashValue = cc.AssetLibrary._urlMapping[key];
        if (hashValue) {
            var matched = false;
            url  = url.replace(ExtnameRegex, function(match, p1) {
                matched = true;
                return '.' + hashValue + p1;
            });
            if (!matched) {
                url = url + '.' + hashValue;
            }
        }

        return url;
    }
};
