var FS = {
    fs: wx && wx.getFileSystemManager(),
    dirname: function(path) {
        return path.replace(/\\/g, '/').replace(/\/[^\/]*$/, '');
    },

    basename: function(path) {
        return path.replace(/\\/g, '/').replace(/.*\//, '');
    },

    mkdirSyncP: function(filepath) {
        try {
            this.fs.mkdirSync(filepath);
        } catch(e) {
            this.mkdirSyncP(this.dirname(filepath));
            this.mkdirSyncP(filepath);
        }
    },

    writeFileSync: function(filepath, data, encoding) {
        try {
            this.fs.writeFileSync(filepath, data, encoding);
        } catch(e) {
            //console.error(e.message);
            var dirpath = this.dirname(filepath);
            //console.error(dirpath);
            this.mkdirSyncP(dirpath);
            this.fs.writeFileSync(filepath, data, encoding);
        }
    },
    mkdirAsyncP: function(filepath, callback, failcallback) {
        var self = this;
        this.fs.mkdir({
            dirPath: filepath,
            success: function (res) {
                callback && callback(0, res);
            },
            fail: function (res) {
                if (filepath.indexOf('/') > -1) {
                    self.mkdirAsyncP(self.dirname(filepath), function () {
                        self.mkdirAsyncP(filepath, callback, failcallback);
                    }, failcallback);
                } else {
                    failcallback && failcallback("Failed create folder!", null);
                }
            }
        })
    },

    writeFileAsync: function(filepath, data, encoding, callback, failcallback) {
        var self = this;
        this.fs.writeFile({
            filePath: filepath,
            data: data,
            encoding: encoding,
            success: function (res) {
                callback && callback(null, 'ok');
            },
            fail: function (res) {
                self.mkdirAsyncP(self.dirname(filepath), function () {
                    self.writeFileAsync(filepath, data, encoding, callback);
                }, function () {
                    failcallback && failcallback('Failed to write file!', null);
                })
            }
        });
    }
};


cc.FS = module.exports = FS;
