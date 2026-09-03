/**
 * ThreatDataProvider Interface structure
 * Any provider added in the future should implement these methods.
 */
class ThreatDataProvider {
  /**
   * Generates a single threat event.
   * @returns {Promise<Object>} An object containing event details (source_ip, source_lat, etc.)
   */
  async generateEvent() {
    throw new Error("Method 'generateEvent()' must be implemented.");
  }
}

export default ThreatDataProvider;
