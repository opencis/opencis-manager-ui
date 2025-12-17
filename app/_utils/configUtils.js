/**
 * Check if the configuration includes no_mld flag
 * @param {Object} configData - Configuration data from backend
 * @returns {boolean} True if no_mld is in the configuration
 */
export function hasNoMldConfig(configData) {
  if (!configData) return false;

  console.log('Checking config for no_mld:', configData);

  // Check if no_mld is in the configuration
  // This could be in different formats depending on how the backend provides it
  if (typeof configData === 'object') {
    // Check if no_mld is a direct property
    if (configData.no_mld !== undefined) {
      console.log('Found no_mld as direct property:', configData.no_mld);
      return Boolean(configData.no_mld);
    }

    // Check if no_mld is in a flags array
    if (Array.isArray(configData.flags)) {
      const hasFlag = configData.flags.includes('no_mld');
      console.log('Checked flags array:', configData.flags, 'has no_mld:', hasFlag);
      return hasFlag;
    }

    // Check if no_mld is in a config array
    if (Array.isArray(configData.config)) {
      const hasConfig = configData.config.includes('no_mld');
      console.log('Checked config array:', configData.config, 'has no_mld:', hasConfig);
      return hasConfig;
    }

    // Check if no_mld is in a string property
    if (typeof configData.config === 'string') {
      const hasString = configData.config.includes('no_mld');
      console.log('Checked config string:', configData.config, 'has no_mld:', hasString);
      return hasString;
    }

    // Check if no_mld is in the filename or configuration name
    if (configData.filename) {
      const hasInFilename = configData.filename.toLowerCase().includes('no_mld');
      console.log('Checked filename:', configData.filename, 'has no_mld:', hasInFilename);
      return hasInFilename;
    }

    if (configData.name) {
      const hasInName = configData.name.toLowerCase().includes('no_mld');
      console.log('Checked config name:', configData.name, 'has no_mld:', hasInName);
      return hasInName;
    }

    if (configData.configName) {
      const hasInConfigName = configData.configName.toLowerCase().includes('no_mld');
      console.log('Checked configName:', configData.configName, 'has no_mld:', hasInConfigName);
      return hasInConfigName;
    }

    // Check if no_mld is in any string property (fallback)
    const configString = JSON.stringify(configData).toLowerCase();
    const hasInString = configString.includes('no_mld');
    console.log('Checked entire config string for no_mld:', hasInString);
    return hasInString;
  }

  // Check if configData is a string
  if (typeof configData === 'string') {
    const hasInString = configData.toLowerCase().includes('no_mld');
    console.log('Checked string config for no_mld:', hasInString);
    return hasInString;
  }

  console.log('No no_mld found in config');
  return false;
}

/**
 * Get configuration display info
 * @param {Object} configData - Configuration data from backend
 * @returns {Object} Configuration display information
 */
export function getConfigDisplayInfo(configData) {
  const hasNoMld = hasNoMldConfig(configData);

  return {
    hasNoMld,
    showLdAllocation: hasNoMld,
    configString: JSON.stringify(configData, null, 2),
    status: hasNoMld ? 'MLD Disabled' : 'MLD Enabled',
    configReceived: configData !== null && configData !== undefined
  };
}