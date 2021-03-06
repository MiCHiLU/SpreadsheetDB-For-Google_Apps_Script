/**
 * SpreadsheetService (Spreadsheet As A DB)
 * @version : 1.0.2
 * @author keisuke (soundTricker318)
 * This Script can be Spreadsheet as a DB for Google Apps Script.
 * And it can do select/insert/update/delete Row(s) on Spreadsheet  by query.
 * it use List Base Feed on Google Spreadsheet API.
 * if you need query reference, you see Google Spreadsheet API reference.
 * And it can full text query to Spreadsheet rows.
 * Caution :Maybe List Base Feed is not support query containts "-" character.if you need contains "-" char,Use full text query.
 */
/*

/** 
 *  Release Note
 * 2012/02/05 1.0.0 first release 
 * 2012/02/07 1.0.1 bug fix and chage logic. if fetch error,not catch error.
 * 2012/02/07 1.0.2 bug fix.Create OAuthOptions Class.
 */

/*
****Example Code*****
Ready Spreadsheet.
sheet as table on Spreadsheet.
Row1 is Header.
*******************************
function testCode() {
  var ss = SpreadsheetApp.getActive();
  var spreadsheetService = new SpreadsheetService(ss.getId());
  //if you need set ConsumerKey and ConsumerSecret,new SpreadsheetService(ss.getId() , "consumerKey" , "consumerSecret");

  //When you use SpreadsheetService,You should call init method.
  spreadsheetService.init(); //When your first call,Need oauth authentification.
  
  var entry = {
    "id":1,
    "name":"soundTricker"
  };
  
  var entry2 = {
    "id":2,
    "name": "soundTricker2"
  };
  
  var entry3 = {
    "id":3,
    "name": "soundTricker2"
  };
  
  //insert
  //If your need insert row, you user insert method
  //insert method args
  //arg0 : sheetName
  //arg1 : insert object, {column : value}
  spreadsheetService.insert(ss.getSheets()[0].getName(), entry);

  //insert
  spreadsheetService.insert(ss.getSheets()[0].getName(), entry2);
  spreadsheetService.insert(ss.getSheets()[0].getName(), entry3);

  
  //select
  //If you need search rows,you use query method.
  //query method args
  //arg0 : sheetName
  //arg1 : query. query reference is http://code.google.com/intl/ja/apis/spreadsheets/data/3.0/reference.html#ListParameters
  //arg2 : advanceObject
  //if you need sorted result or revesed result or full-text query,you set advanceObject.
  //advanceObject field is 
  // { orderby : "column:columnName" ,//Specifies what column to use in ordering the entries in the feed.
  //   reverse:true/false , // Specifies whether to sort in descending or ascending order.
  //   q: full-text-query for rows
  // };
  
  //if you need all rows,arg1 set empty string.
  var rows = spreadsheetService.query(ss.getSheets()[0].getName(), "");  //maybe rows length is 3, and rows[0]'s is 1, rows[1]'s id is 2, rows[2]'s id is 3

  //order desc and filter and 
  rows = spreadsheetService.query(ss.getSheets()[0].getName() , "name=soundTricker2" ,{orderby : "column:id" , reverse : true});
  
  //query result always return as a array. if result length is 1.
  var row = spreadsheetService.query(ss.getSheets()[0].getName() , "name=soundTricker2 && id=3");
  
  row[0].name = "soundTricker3";
  
  //update
  //If you need update row,you use update method.
  //update method args
  //arg0 : sheetName
  //arg1 : update object. it shoud be selected object.
  spreadsheetService.update(ss.getSheets()[0].getName() , row[0]);
  
  
  //full text search
  var row = spreadsheetService.query(ss.getSheets()[0].getName() , "" , {q:"soundTricker3"});
  
  
  //delete
  //If you need delete row,you use delete method
  //delete method args
  //arg0 ; sheetName
  //arg1 : delete object. it shoud be selected object
  spreadsheetService.deleteEntry(ss.getSheets()[0].getName() , row[0]);
  
  
  //if you update sheetName or add sheet.
  //you should call refleshListKey method
  spreadsheetService.refleshListKey();
}

*/
/*
 * The MIT License
 * 
 * Copyright (c) 2011-2012 soundTricker <twitter [at]soundTricker318>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
*/
(function(){
  var OAuthOptions = this.OAuthOptions = function(method , headers) {
    if(headers) {
      this.headers = headers;
      this.headers["GData-Version"] = "3.0";
    } else {
      this.headers =  {"GData-Version": "3.0"};
    }
    this.method = method;
    this.oAuthServiceName = "SpreadsheetQuery";
    this.oAuthUseToken = "always";
  };
  var SpreadsheetService = this.SpreadsheetService = function(key,consumeKey,consumerSecret,spreadsheetApp) {
    
    this.KEY_PREFIX = "SpreadsheetApiService_";
    this.key = key;
    this.SHEET_LIST_KEY = this.KEY_PREFIX + this.key + "_SheetList";
    this.spreadsheetApp = spreadsheetApp || SpreadsheetApp;
    
    this.dbSpreadsheet = this.spreadsheetApp.openById(key);

    var oauth = UrlFetchApp.addOAuthService("SpreadsheetQuery");
    oauth.setRequestTokenUrl("https://www.google.com/accounts/OAuthGetRequestToken?scope=https%3A%2F%2Fspreadsheets.google.com%2Ffeeds%2F");
    oauth.setConsumerKey(consumeKey||"anonymous");
    oauth.setConsumerSecret(consumerSecret||"anonymous");
    oauth.setAuthorizationUrl("https://www.google.com/accounts/OAuthAuthorizeToken");
    oauth.setAccessTokenUrl("https://www.google.com/accounts/OAuthGetAccessToken");
  };
  
  SpreadsheetService.prototype = {
    
    init : function() {
      var listString = ScriptProperties.getProperty(this.SHEET_LIST_KEY);
      
      if(listString != null) {
        this.sheetList = Utilities.jsonParse(listString);
        return;
      }
      this.refleshListKey();
    },
    
    refleshListKey : function() {
      var worksheetFeed = this.getWorksheetFeed();
      
      this.sheetList = {};
      for(var i = 0;i < worksheetFeed.feed.entry.length;i++) {
        
        var splitSheetId = worksheetFeed.feed.entry[i].id["$t"].split("/");
        var sheetId = splitSheetId[splitSheetId.length -1];
        
        var sheetName = worksheetFeed.feed.entry[i].title["$t"];
        
        this.sheetList[sheetName] = sheetId;
      }
      ScriptProperties.setProperty(this.SHEET_LIST_KEY, Utilities.jsonStringify(this.sheetList));
    },
    
    getWorksheetFeed : function() {
      var url = "https://spreadsheets.google.com/feeds/worksheets/" + this.key + "/private/full?alt=json&prettyprint=true";
      
      var res = UrlFetchApp.fetch(url, new OAuthOptions("get"));
      
      var worksheetFeed = Utilities.jsonParse(res.getContentText());
      
      return worksheetFeed;
      
    },
    
    deleteEntry : function(sheetName , entry) {
      if(!entry || !entry.__originalEntry__) {
        throw new Error("nothing entry or that entry is not selected entry. this method can delete selected entry");
      }
      
      var deleteOptions = new OAuthOptions("delete" , {"If-Match" : "*"});
      deleteOptions.contentType = "application/atom+xml";
      var url = entry.__originalEntry__.link[0].href;
      return  UrlFetchApp.fetch(url, deleteOptions);
    },
    
    insert : function(sheetName , entry) {
      if(!entry) {
        throw new Error("nothing entry");
      }
      
      var xmlChildren = [];
      
      xmlChildren.push(Xml.attribute("xmlns" , "http://www.w3.org/2005/Atom"));
      xmlChildren.push(Xml.attribute("xmlns:gsx" , "http://schemas.google.com/spreadsheets/2006/extended"));
      for(var index in entry) {
        if(index == "__originalEntry__") {
          continue;
        }
        xmlChildren.push(Xml.element("gsx:" + index, [entry[index]]));
      }
      
      var url = "https://spreadsheets.google.com/feeds/list/" + this.key + "/" + this.sheetList[sheetName] +  "/private/full";
      var xml = Xml.element("entry", xmlChildren);
      var postOptions = new OAuthOptions("post");
      postOptions.contentType = "application/atom+xml";
      postOptions.payload = xml.toXmlString();
      
      return UrlFetchApp.fetch(url, postOptions);
    },
    
    update : function(sheetName , entry) {
      if(!entry.__originalEntry__) {
        throw new Error("Given __originalEntry__ property. that set at this.query method");
      }
      var xmlChildren = [];
      xmlChildren.push(Xml.element("id", [entry.__originalEntry__.id["$t"]]));
      xmlChildren.push(Xml.element("updated", [Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd'T'HH:mm:ss.sss'Z'")]));
      xmlChildren.push(Xml.attribute("xmlns" , "http://www.w3.org/2005/Atom"));
      xmlChildren.push(Xml.attribute("xmlns:gsx" , "http://schemas.google.com/spreadsheets/2006/extended"));
      xmlChildren.push(Xml.attribute("xmlns:gd" , "http://schemas.google.com/g/2005"));
      xmlChildren.push(Xml.attribute("gd:etag" , entry.__originalEntry__["gd$etag"]));
      xmlChildren.push(Xml.element("link" ,
                                   [
                                     Xml.attribute("rel", "self") ,
                                     Xml.attribute("type", "application/atom+xml"),
                                     Xml.attribute("href", entry.__originalEntry__.id["$t"])
                                   ]));
      xmlChildren.push(Xml.element("link" ,
                                   [
                                     Xml.attribute("rel", "edit") ,
                                     Xml.attribute("type", "application/atom+xml"),
                                     Xml.attribute("href", entry.__originalEntry__.link[0].href)
                                   ]));
      xmlChildren.push(Xml.element("category", 
                                   [
                                     Xml.attribute("scheme", "http://schemas.google.com/spreadsheets/2006"),
                                     Xml.attribute("term", "http://schemas.google.com/spreadsheets/2006#list")
                                   ]));
      var content = "";
      for(var index in entry) {
        if(index == "__originalEntry__") {
          continue;
        }
        xmlChildren.push(Xml.element("gsx:" + index, [entry[index], Xml.attribute("type", "text")]));
        content += index + ":" + entry[index] + ",";
      }
      xmlChildren.push(Xml.element("content" ,
                                   [
                                     Xml.attribute("type", "text"),
                                     encodeURI(content)
                                   ]));
      

      var xml = Xml.element("entry", xmlChildren);
      var putOptions = new OAuthOptions("put");
      putOptions.contentType = "application/atom+xml";
      putOptions.payload = xml.toXmlString();
      var url = entry.__originalEntry__.link[0].href;
      var res = UrlFetchApp.fetch(url, putOptions);
      return res;
    },
    
    
    query : function(sheetName, queryString, advanceOptions) {
      var reverse;
      var order;
      var optionString = "";
      if(advanceOptions) {
        optionString = "&";
        for(var index in advanceOptions) {
            optionString += index + "=" + encodeURI(advanceOptions[index]) + "&";
        }
      }
      if(!this.sheetList[sheetName]) {
        this.refleshListKey();
      }
      var url = "https://spreadsheets.google.com/feeds/list/" + this.key + "/" + this.sheetList[sheetName] +  "/private/full?alt=json&prettyprint=false&v=3.0&sq=" + encodeURIComponent(queryString) + optionString;
      var res =  UrlFetchApp.fetch(url,new OAuthOptions("get"));
      var j = Utilities.jsonParse(res.getContentText());
      
      var entries = j.feed.entry;
      
      var dataList = [];
      
      if(!entries) {
        return dataList;
      }
      for(var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var data = {};
        data.__originalEntry__ = entry;
        for(var index in entry) {
          if(index.indexOf("gsx$") < 0)  {
            continue;
          }
          data[index.replace("gsx$","")] = entry[index]["$t"];
        }
        dataList.push(data);
      }
      return dataList;
    }
    
  };
})();
