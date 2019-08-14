import Promise from 'promise-polyfill';
import 'whatwg-fetch';
import config from './config';
import log from './log';
import { updateLocalizationSettings } from './localize';
import { sendPortalCommand } from './portal';

const metadata = require('../../metadata.json');

/**
 * Attempt to load a vendor list from the local domain. If a
 * list is not found attempt to load it from the global list location
 * using the "portal" for cross domain communication.
 */
function fetchVendorList(vendors) {
  return fetch(config.globalVendorListLocation)
    .then(res => res.json())
    .then(globalVendors => {
      // update selected vendors against global vendor list
      console.log('fetchVendorList', globalVendors);
      console.log('fetchVendorList', vendors);
      if (!vendors || vendors.length === 0) {
        return updateSelectedVendors(vendors, globalVendors);
      }

      return globalVendors;
    })
    .catch(() => {
      log.debug('Configured vendors.json not found. Requesting global list');
      return sendPortalCommand({ command: 'readVendorList' });
    });
}

function fetchGlobalVendorList() {
  // TODO no magic string - extract somwhere
  return fetch('https://vendorlist.consensu.org/vendorlist.json')
    .then(res => res.json())
    .catch(() => {
      log.debug('Global vendor list not found');
      return sendPortalCommand({ command: 'readVendorList' });
    });
}

function fetchLocalizedPurposeList() {
  let interpolate = (string, args) =>
    string.replace(/\${(\w+)}/g, (_, v) => args[v]);

  const consentLanguage = updateLocalizationSettings({
    forceLocale: config.forceLocale,
    localization: config.localization,
  });
  let url = interpolate(metadata.localizedVendorListProvider, {
    consentLanguage: consentLanguage.toLowerCase(),
  });
  return fetch(url)
    .then(res => res.json())
    .catch(err => {
      log.error(
        `Failed to load standard purposes in the selected language`,
        err,
      );
    });
}

function fetchCustomPurposeList() {
  if (!config.storePublisherData || !config.customPurposeListLocation) {
    return Promise.resolve();
  }

  return fetch(config.customPurposeListLocation)
    .then(res => res.json())
    .catch(err => {
      log.error(
        `Failed to load custom purposes list from ${
          config.customPurposeListLocation
        }`,
        err,
      );
    });
}

function updateSelectedVendors(selectedVendors, globalVendors) {
  selectedVendors.lastUpdated = globalVendors.lastUpdated;
  selectedVendors.version = globalVendors.vendorListVersion;
  selectedVendors.vendors = selectedVendors.vendors
    .map(customVendor => {
      // update selected vendors with fetched global versions
      return globalVendors.vendors.find(globalVendor => {
        return customVendor && globalVendor.id === customVendor.id;
      });
    })
    // filter out undefined vendors
    .filter(customVendor => {
      return customVendor && customVendor.id;
    });
  return selectedVendors;
}

export { fetchVendorList, fetchLocalizedPurposeList, fetchCustomPurposeList };
