export interface IDatabaseAgent {
  /**
   * Formats text with HTML tags for better display
   * @param text The text to format
   * @returns Formatted text with HTML tags
   */
  formatTextWithHTML(text: string): string;
} 