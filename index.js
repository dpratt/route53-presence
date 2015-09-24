"use strict";
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION
});

const route53 = new AWS.Route53();
const metadata = new AWS.MetadataService();

function getPrivateIP(cb) {
  const timeout = setTimeout(function() { 
    _handleError("Timed out looking for instance metadata. Exiting."); 
  }, 2000);
  timeout.unref();
  
  metadata.request('/latest/meta-data/local-ipv4', function(err, data) {
    clearTimeout(timeout);
    if (err) { return cb(err); }
    console.log('Using IP ' + data);
    cb(null, data);
  });
}

function getAddresses(zoneId, dnsName, cb) {
  const params = {
    HostedZoneId: zoneId,
    MaxItems: '1',
    StartRecordName: dnsName,
    StartRecordType: 'A'
  };
  route53.listResourceRecordSets(params, function(err, data) {
    if (err) { return cb(err); }
    //The amazon API returns a BIND-style FQDN with a period on the end.
    let recordName = dnsName;
    if(!recordName.endsWith(".")) {
      recordName = recordName + ".";
    }
    if(data.ResourceRecordSets.length == 0 || data.ResourceRecordSets[0].Name != recordName) {
      cb(null, null);
    } else {      
      cb(null, data.ResourceRecordSets[0].ResourceRecords);          
    }
  });
}

function updateRecord(zoneId, dnsName, records, cb) {
  const params = {
    HostedZoneId: zoneId,
    ChangeBatch: {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: dnsName,
          Type: 'A',
          ResourceRecords: records,
          TTL: 300
        }
      }]
    }
  };
  console.log("Updating hostname: " + dnsName + " addresses: " + JSON.stringify(records));
  
  route53.changeResourceRecordSets(params, cb);      
}

function deleteRecord(zoneId, dnsName, records, cb) {
  const params = {
    HostedZoneId: zoneId,
    ChangeBatch: {
      Changes: [{
        Action: 'DELETE',
        ResourceRecordSet: {
          Name: dnsName,
          Type: 'A',
          ResourceRecords: records,          
          TTL: 300          
        }
      }]
    }
  };
  console.log("Deleting " + dnsName);
  
  route53.changeResourceRecordSets(params, cb);      
}


function addAddress(zoneId, dnsName, address, cb) {  
  getAddresses(zoneId, dnsName, function(err, addresses) {
    if(err) { return cb(err); }
    console.log("Adding address " + address + " to " + dnsName);
    if(addresses == null) {
      //the record does not exist - we need to create it
      console.log("Creating DNS entry for " + dnsName);
      updateRecord(zoneId, dnsName, [{ Value: address }], cb)      
    } else {
      const existingIndex = addresses.findIndex(function(elem) {
        return elem.Value == address;
      });
      if(existingIndex == -1) {
        //the address is not present in the list
        addresses.push({ Value: address });
        updateRecord(zoneId, dnsName, addresses, cb);            
      } else {
        console.log("Instance private IP already in list. Skipping operation.");
        cb(null, {});
      }      
    }
  });
}

function removeAddress(zoneId, dnsName, address, cb) {
  getAddresses(zoneId, dnsName, function(err, addresses) {
    if(err) { return cb(err); }
    if(addresses == null) {
      //entry does not exist, so skip deletion.
      console.log("No DNS entry found for " + dnsName + ", skipping removal operation.");
      cb(null, {});      
    } else {
      const existingIndex = addresses.findIndex(function(elem) {
        return elem.Value == address;
      });
      if(existingIndex != -1) {
        if(addresses.length == 1) {
          //removing the address would empty the record, delete it instead
          console.log("Deleting DNS record " + dnsName);
          //the aws API requires the current, existing ResourceRecords for a DELETE request
          deleteRecord(zoneId, dnsName, addresses, cb);                    
        } else {
          addresses.splice(existingIndex, 1);        
          console.log("Updating " + dnsName + " with addresses " + JSON.stringify(addresses));
          updateRecord(zoneId, dnsName, addresses, cb);                    
        }
      } else {
        console.log("Instance private IP not in Route53 record. Skipping operation.");
        cb(null, {});
      }      
    }
  });
}


function _waitForever() {
  setTimeout(function() { _waitForever(); }, 100000);
}

function _handleError(err) {
  console.error(err);
  process.exit(1);
}

const zoneId = process.env.ROUTE53_ZONE_ID
if(!zoneId) {
  _handleError("Must supply a zone ID in ROUTE53_ZONE_ID.")
}
const dnsName = process.env.ROUTE53_DNS_NAME
if(!dnsName) {
  _handleError("You must supply the DNS name of an A record.")
}

let _exitInProgress = false;

function _exitProcess(address) {
  if (!_exitInProgress) {
    _exitInProgress = true;
    //we get 5 seconds to delete it, otherwise we die
    setTimeout(function() { console.log("Timed out waiting for delete. Exiting."); process.exit(-1); }, 5000).unref();
    
    removeAddress(zoneId, dnsName, address, function(err) {
      if (err) {return _handleError(err); }
      console.log("Address removed.");
      process.exit(0);      
    })
  }
}

getPrivateIP(function(err, privateIp) {
  if (err) {return _handleError(err); }
  console.log("Local private IP " + privateIp + " detected. Updating Route53 record.");
  addAddress(zoneId, dnsName, privateIp, function(err) {
    if (err) {return _handleError(err); }
    
    //make sure we deregister this address before we exit
    process.on('SIGINT', function() {
      console.log('Received SIGINT. Exiting...');
      _exitProcess(privateIp);
    });

    process.on('SIGTERM', function() {
      console.log('Received SIGTERM. Exiting...');
      _exitProcess(privateIp);
    });
    
    console.log("Update successful. Waiting for termination.")
    _waitForever();
  });
})
// Main processing logic...
