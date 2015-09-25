var rp = require('request-promise');
var config = require('./config.js');
var http = require('http');
var url = require('url');

var gamesdb = {
    
    getGame: function (id) {
    },
    
    getGamesByPlatform: function (platformid, platformname) {
        if (platformid) {
            var gameDbRef = config.thegamedb;
            var gameDbUrl = gameDbRef.url + gameDbRef.endpoints.GetPlatformGames + '?platform=' + platformid;
            
            options = {
                uri : gameDbUrl,
                timeout : 1800000
            }
            
            console.log('calling GamesDB.net - GetPlatformGames for: ' + platformname);
            return rp(options);
        }
    },
    
    getGamesPlatformList: function (){
        var gameDbRef = config.thegamedb;
        var gameDbUrl = gameDbRef.url + gameDbRef.endpoints.GetPlatformsList;
        
        options = {
            uri : gameDbUrl,
            timeout : 1800000
        }
        
        console.log('calling GamesDB.net - GetGamesPlatformList');
        return rp(options);
    },

    searchGames: function (query) {
        if (query !== null && query !== undefined && query !== '') {
            
            var gameDbRef = config.thegamedb;
            var gameDbUrl = gameDbRef.url + gameDbRef.endpoints.GetGamesList + '?name=' + encodeURIComponent(query.toLowerCase());
            
            options = {
                uri : gameDbUrl,
                timeout : 1800000
            }
            
            console.log('calling GamesDB.net - GetGamesList');
            return rp(options);
        }
        return null;
    },
};

module.exports = gamesdb;