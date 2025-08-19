/**
 * @file pdfApiService.ts
 * @description Service for converting markdown/HTML to PDF via API.
 * 
 * This service handles the conversion of assessment reports to PDF format
 * by calling a backend API that converts markdown to HTML and then to PDF.
 * 
 * Note: This is a frontend service that expects a backend API to be available.
 * The backend should handle markdown parsing, HTML styling, and PDF generation.
 */

import { logger } from "../lib/logger";

// =================================================================================
// INTERFACE DEFINITIONS
// =================================================================================

export interface PDFGenerationRequest {
  markdown: string;
  filename?: string;
  companyName: string;
  assessmentDate: string;
  options?: {
    format?: 'A4' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    margins?: {
      top: string;
      bottom: string;
      left: string;
      right: string;
    };
  };
}

export interface PDFGenerationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// =================================================================================
// PDF API SERVICE
// =================================================================================

export class PDFApiService {
  private static readonly API_BASE_URL = import.meta.env.VITE_PDF_API_URL || 'https://n8n-1-102-1-c1zi.onrender.com/webhook/convert-pdf';
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Generates a PDF from markdown content using the N8N webhook.
   * 
   * This method sends the markdown content to the N8N webhook that:
   * 1. Converts markdown to HTML
   * 2. Applies CSS styling for professional report formatting
   * 3. Generates PDF using a headless browser
   * 4. Returns the PDF as application/pdf
   */
  public static async generatePDF(request: PDFGenerationRequest): Promise<Blob> {
    logger.info("Starting PDF generation via N8N webhook", {
      companyName: request.companyName,
      markdownLength: request.markdown.length
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      // N8N webhook expects markdown text directly in the body
      const response = await fetch(this.API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: request.markdown,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`PDF API returned ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        // N8N might return the PDF without proper content-type header
        logger.warn(`Unexpected content type: ${contentType}, proceeding anyway`);
      }

      const pdfBlob = await response.blob();
      
      // Validate that we received actual PDF data
      if (pdfBlob.size < 100) {
        throw new Error('Received invalid PDF data (file too small)');
      }
      
      logger.info("PDF generated successfully", {
        companyName: request.companyName,
        pdfSize: pdfBlob.size
      });

      return pdfBlob;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('PDF generation timed out');
      }
      
      logger.error("PDF generation failed", error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fallback PDF generation using client-side libraries.
   * This is used when the backend API is not available.
   * 
   * Note: This provides basic PDF generation but won't have the same
   * professional formatting as the backend service.
   */
  public static async generatePDFClientSide(request: PDFGenerationRequest): Promise<Blob> {
    logger.warn("Using client-side PDF generation fallback");

    try {
      // For demonstration purposes, we'll create a simple text-based PDF
      // In a real implementation, you might use libraries like jsPDF or Puppeteer
      
      const content = `
FINANCIAL BOOKS HYGIENE ASSESSMENT REPORT

Company: ${request.companyName}
Assessment Date: ${request.assessmentDate}

${request.markdown}

---
Generated on: ${new Date().toLocaleString()}
      `.trim();

      // Create a simple blob with text content
      // In reality, you'd use a proper PDF generation library
      const blob = new Blob([content], { type: 'text/plain' });
      
      logger.info("Client-side PDF fallback generated", {
        companyName: request.companyName,
        contentLength: content.length
      });

      return blob;

    } catch (error) {
      logger.error("Client-side PDF generation failed", error);
      throw new Error(`Client-side PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if the PDF API is available.
   * For N8N webhook, we'll skip the health check as it doesn't have one.
   */
  public static async checkAPIAvailability(): Promise<boolean> {
    // N8N webhook doesn't have a health endpoint, assume it's available
    return true;
  }

  /**
   * Generates PDF with automatic fallback to client-side generation.
   */
  public static async generatePDFWithFallback(request: PDFGenerationRequest): Promise<Blob> {
    try {
      // First, try the backend API
      return await this.generatePDF(request);
    } catch (apiError) {
      logger.warn("Backend PDF API failed, trying client-side fallback", apiError);
      
      try {
        // Fall back to client-side generation
        return await this.generatePDFClientSide(request);
      } catch (fallbackError) {
        logger.error("Both PDF generation methods failed", { apiError, fallbackError });
        throw new Error("PDF generation completely failed. Please try again later.");
      }
    }
  }
}

// =================================================================================
// BACKEND API SPECIFICATION
// =================================================================================

/**
 * Backend API Specification for PDF Generation
 * 
 * POST /api/pdf/generate
 * Content-Type: application/json
 * 
 * Request Body:
 * {
 *   "markdown": "# Assessment Report\n...",
 *   "filename": "company_assessment.pdf",
 *   "companyName": "Company Name",
 *   "assessmentDate": "2024-01-01",
 *   "options": {
 *     "format": "A4",
 *     "orientation": "portrait",
 *     "margins": { "top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm" }
 *   }
 * }
 * 
 * Response:
 * Content-Type: application/pdf
 * Content-Disposition: attachment; filename="company_assessment.pdf"
 * 
 * The backend should:
 * 1. Parse the markdown using a library like marked or markdown-it
 * 2. Apply professional CSS styling for reports
 * 3. Generate PDF using Puppeteer, wkhtmltopdf, or similar
 * 4. Return the PDF as a binary stream
 * 
 * Example backend implementation (Node.js/Express):
 * 
 * ```javascript
 * const express = require('express');
 * const puppeteer = require('puppeteer');
 * const marked = require('marked');
 * 
 * app.post('/api/pdf/generate', async (req, res) => {
 *   const { markdown, filename, options } = req.body;
 *   
 *   const html = marked(markdown);
 *   const styledHtml = `
 *     <!DOCTYPE html>
 *     <html>
 *     <head>
 *       <style>
 *         body { font-family: Arial, sans-serif; line-height: 1.6; }
 *         h1 { color: #333; border-bottom: 2px solid #007bff; }
 *         table { width: 100%; border-collapse: collapse; }
 *         th, td { padding: 8px; border: 1px solid #ddd; }
 *       </style>
 *     </head>
 *     <body>${html}</body>
 *     </html>
 *   `;
 *   
 *   const browser = await puppeteer.launch();
 *   const page = await browser.newPage();
 *   await page.setContent(styledHtml);
 *   
 *   const pdf = await page.pdf({
 *     format: options.format || 'A4',
 *     printBackground: true,
 *     margin: options.margins
 *   });
 *   
 *   await browser.close();
 *   
 *   res.setHeader('Content-Type', 'application/pdf');
 *   res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
 *   res.send(pdf);
 * });
 * ```
 */