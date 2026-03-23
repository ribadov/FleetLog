"use client";

import { useEffect } from "react";

export function PrintPageNumbers() {
  useEffect(() => {
    // Update page numbers on print
    const updatePageNumbers = () => {
      const style = document.createElement("style");
      style.textContent = `
        @media print {
          @page {
            size: A4;
            margin: 2cm 1cm 2.5cm 1cm;

            @top-right {
              content: "S. " counter(page) " / " counter(pages);
              font-size: 8pt;
              color: #777;
            }
          }

          body {
            margin: 0;
            padding: 0;
          }
          
          tr {
            page-break-inside: avoid;
          }
          
          .invoice-header-card {
            page-break-inside: avoid;
          }
          
          .invoice-addresses-card {
            page-break-inside: avoid;
          }
        }
      `;
      document.head.appendChild(style);
    };

    updatePageNumbers();
  }, []);

  return null;
}
