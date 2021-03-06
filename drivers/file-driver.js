//
// Provider: "file" (provides a REST interface to files in a directory and subdirectories)
//
var express = require('express');
var fs = require('fs-extra');
var path = require('path');

var logger = require('log4js').getLogger("file-driver");

function toSafeLocalPath(basePath, fileName)
{
    // path.posix.normalize will move any ../ to the front, and the regex will remove them.
    //
    var safeFilename = path.posix.normalize(fileName).replace(/^(\.\.[\/\\])+/, '');
    var filePath = path.posix.join(basePath, safeFilename); 

    if (path.sep != '/')
    {
        // Replace forward slash with local platform seperator
        //
        filePath = filePath.replace(/[\/]/g, path.sep);
    }

    return filePath;
}

// Directory lising object format:
//
// [
//   { type: "file", name: "foo.txt" },
//   { type: "directory", name: "bar", objects: [
//       { type: "file", name: "baz.txt" }  
//   ]}
// ]
//
function getObjects(dirPath)
{
    var output = [];

    var fileObjects = fs.readdirSync(dirPath);
    for (var i = 0; i < fileObjects.length; i++)
    {
        logger.debug("Found file object: %s on path: %s", fileObjects[i], dirPath);
        var objPath = path.join(dirPath, fileObjects[i]);
        var stats = fs.statSync(objPath);
        if (stats.isDirectory())
        {
            output.push({ type: "directory", name: fileObjects[i], objects: getObjects(objPath) });
        }
        else
        {
            output.push({ type: "file", name: fileObjects[i] });
        }
    }

    return output;
}

module.exports = function(params)
{
    var basePath = params.basePath;

    logger.info("Using file store, basePath:", basePath);

    var driver = 
    {
        provider: "file",
        doesObjectExist: function(filename, callback)
        {
            var filePath = toSafeLocalPath(basePath, filename);
            try
            {
                callback(null, fs.existsSync(filePath));
            }
            catch (err)
            {
                callback(err);
            }
        },
        getObject: function(filename, callback)
        {
            var filePath = toSafeLocalPath(basePath, filename);

            try
            {
                var stats = fs.statSync(filePath);
                if (stats.isDirectory())
                {
                    var dir = getObjects(filePath);
                    callback(null, dir);
                }
                else
                {
                    fs.readFile(filePath, callback);
                }
            }
            catch (err)
            {
                if (err.code === 'ENOENT')
                {
                    // We return null content to indicate "Not found"
                    err = null;
                }
                callback(err, null);
            }
        },
        putObject: function(filename, content, callback)
        {
            var filePath = toSafeLocalPath(basePath, filename); 
            // outputFile will create parent directory if it doesn't exist
            fs.outputFile(filePath, content, callback);
        },
        deleteObject: function(filename, callback)
        {
            // This will remove a file or a directory, so let's hope it's used correctly
            //
            var filePath = toSafeLocalPath(basePath, filename); 
            fs.remove(filePath, callback);
        }
    }

    return driver;
}
