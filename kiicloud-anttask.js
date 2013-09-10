importClass(java.io.OutputStreamWriter);
importClass(java.net.URL);
importClass(java.lang.StringBuffer);
importClass(java.io.InputStreamReader);
importClass(java.io.BufferedReader);

var COMMANDS = {
  registerUser: cmdRegisterUser,
  unregisterUser: cmdUnregisterUser,
  loginUser: cmdLoginUser,
  test: cmdTest,
};

var SITES = {
  US: 'https://api.kii.com/',
  JP: 'https://api-jp.kii.com/',
  CN: 'https://api-cn2.kii.com/',
};

var ENCODING = 'UTF-8';

////////////////////////////////////////////////////////////////////////////
// App class.

function App(site, id, key) {
  this.site = site.toUpperCase();
  this.apiRoot = SITES[this.site];
  if (!this.apiRoot) {
    self.fail('Unknown site: ' + site);
  }
  this.id = id;
  this.key = key;
}

App.prototype.getURL = function(path) {
  return new URL(this.apiRoot + 'api/' + path);
}

App.prototype.getAppURL = function(path) {
  return this.getURL('apps/' + this.id + '/' + path);
}

App.prototype.getHeaders = function(extend) {
  var headers = {
    'X-Kii-AppID': this.id,
    'X-Kii-AppKey': this.key,
  };
  // copy keys and valuas from extend to headers.
  if (extend) {
    for (var k in extend) {
      var v = extend[k];
      if (v) {
        headers[k] = v;
      }
    }
  }
  return headers;
}

////////////////////////////////////////////////////////////////////////////
// Utilitiy functions.

function getElementString(name) {
  var value = elements.get(name);
  if (!value) {
    self.fail('child "' + name + '" element is misssing');
  }
  return new String(value.get(0));
}

function getApp() {
  var site = getElementString('site');
  var id = getElementString('app_id');
  var key = getElementString('app_key');
  return new App(site, id, key);
}

function getUser() {
  var username = getElementString('username');
  var password = getElementString('password');
  return { username: username, password: password };
}

function readAll(stream) {
  var s = ''
  var r = new BufferedReader(new InputStreamReader(stream, ENCODING));
  while (true) {
    var line = r.readLine();
    if (!line) {
      break;
    }
    s += line + '\n';
  }
  return s;
}

function parseAsJson(stream) {
  var s = readAll(stream);
  return JSON.parse(s);
}

function http(url, headers, data) {
  return http2(null, url, headers, data);
}

function http2(method, url, headers, data) {
  var conn = new URL(url).openConnection();
  if (headers) {
    for (var name in headers) {
      conn.setRequestProperty(name, headers[name]);
    }
  }
  if (data) {
    conn.setDoOutput(true);
    conn.setRequestMethod(method ? method : 'POST');
    var w = new OutputStreamWriter(conn.getOutputStream(), ENCODING);
    w.write(data);
    w.flush();
    w.close();
  } else {
    conn.setRequestMethod(method ? method : 'GET');
  }
  conn.connect();
  return conn;
}

function registerUser(app, username, password) {
  var url = app.getAppURL('users');
  var headers = app.getHeaders({ 'Content-Type': 'application/json' });
  var data = { loginName: username, password: password };

  var conn = http(url, headers, JSON.stringify(data));
  var sc = conn.getResponseCode();

  switch (sc) {
    case 201: case 409:
      return true;
    default:
      self.log('registerUser() failed: ' + sc);
      return false;
  }
}

function unregisterUser(app, username, password) {
  var token = loginUser(app, username, password);
  if (token == null) {
    return false;
  }

  var url = app.getAppURL('users/me');
  var headers = app.getHeaders({ 'Authorization': 'Bearer ' + token });

  var conn = http2('DELETE', url, headers, null);
  var sc = conn.getResponseCode();

  switch (sc) {
    case 204:
      return true;
    default:
      self.log('unregisterUser() failed: ' + sc);
      return false;
  }
}

function loginUser(app, username, password) {
  var url = app.getURL('oauth2/token');
  var data = { username: username, password: password };
  var headers = app.getHeaders({ 'Content-Type': 'application/json' });

  var conn = http(url, headers, JSON.stringify(data));
  var sc = conn.getResponseCode();
  if (sc != 200) {
    println(readAll(conn.getErrorStream()));
    self.log('loginUser() failed: ' + sc);
    return null;
  }

  // extract access_token.
  var resp = parseAsJson(conn.getInputStream());
  return resp['access_token'];
}

////////////////////////////////////////////////////////////////////////////
// Command dispatch.

var cmd = attributes.get('cmd');
var command = COMMANDS[cmd];
if (command) {
  command();
} else {
  self.fail('Unknown command: ' + cmd);
}

////////////////////////////////////////////////////////////////////////////
// Commands

function cmdRegisterUser() {
  var app = getApp();
  var user = getUser();
  if (!registerUser(app, user.username, user.password)) {
    self.fail('registerUser failed');
  }
  self.log('a user "' + user.username + '" registered');
}

function cmdUnregisterUser() {
  var app = getApp();
  var user = getUser();
  if (!unregisterUser(app, user.username, user.password)) {
    self.fail('unregisterUser failed');
  }
  self.log('a user "' + user.username + '" deleted');
}

function cmdLoginUser() {
  var app = getApp();
  var user = getUser();
  if (!loginUser(app, user.username, user.password)) {
    self.fail('loginUser failed');
  }
  self.log('login succeeded for user "' + user.username + '"');
}

function cmdTest() {
  println('Hello Kii Cloud Utilities for Apache ant.');
}
