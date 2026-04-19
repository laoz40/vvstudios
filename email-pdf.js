const htmlEmail = `
    <div style="background-color: #f4f5f7; padding: 40px 20px; font-family: Helvetica, Arial, sans-serif;">
      <div style="background-color: #ffffff; color: #333333; max-width: 550px; margin: 0 auto; line-height: 1.6; padding: 40px; border-radius: 12px;">
        
        <div style="text-align: right; color: #868e96; font-size: 12px; margin-bottom: 10px;">
          Invoice #${invoiceNumber}
        </div>

        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${emailLogoURL}" alt="Vertigo Visuals" style="max-width: 120px;">
        </div>

        <p style="font-size: 16px;">Hi ${safeName},</p>
        <p style="font-size: 16px;">Thank you for booking the studio. Your full itemized invoice for your upcoming session on <strong>${bookingDate}</strong> is attached to this email.</p>

        <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0;">
          <p style="margin: 0; font-size: 13px; color: #6c757d; text-transform: uppercase;">Remaining Balance Due</p>
          <p style="margin: 5px 0; font-size: 36px; font-weight: bold;">$${total}</p>
          <p style="margin: 0; font-size: 14px; color: #d90429; font-weight: bold;">Due: ${dueDate}</p>
        </div>

        <h3 style="font-size: 14px; text-transform: uppercase; color: #6c757d; margin-bottom: 10px;">Payment Options</h3>
        <div style="background-color: #ffffff; border-left: 4px solid #333333; padding: 12px 20px; font-size: 15px; margin-bottom: 20px; border: 1px solid #eeeeee;">
          <p style="margin: 0 0 8px 0;"><strong>Bank Transfer:</strong> BSB: 082-124 | Acc: 432849833</p>
          <p style="margin: 0;"><strong>PayID:</strong> 0434367184</p>
        </div>

        <div style="background-color: #e9ecef; border-radius: 6px; padding: 15px 20px; margin-bottom: 30px;">
          <p style="margin: 0 0 6px 0; font-size: 14px;"><strong>Due:</strong> End of day on ${dueDate}</p>
          <p style="margin: 0 0 6px 0; font-size: 14px;"><strong>Payment:</strong> Settle early via Bank Transfer / PayID, or pay in-studio.</p>
          <p style="margin: 0; font-size: 13px; color: #555;"><em>*If transferring on the day, please email the receipt.</em></p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 14px;">
          <p style="margin: 0;"><strong>Studio Location:</strong></p>
          <p style="margin: 4px 0 0 0;"><a href="https://www.google.com/maps/place/VV+Podcast+Studio/@-33.99295,150.8825607,16z/data=!4m6!3m5!1s0x6b12eb627eb32a41:0x1d9f8a29ef1452af!8m2!3d-33.992871!4d150.8824306!16s%2Fg%2F11y4yd08qy?entry=ttu&g_ep=EgoyMDI2MDQwNy4wIKXMDSoASAFQAw%3D%3D" style="color: #0066cc; text-decoration: none;">View Directions on Google Maps</a></p>
        </div>

        <p style="font-size: 15px; margin: 20px 0 0 0;">Best regards,</p>
        <p style="font-size: 15px; font-weight: bold; margin: 2px 0 0 0;">Vertigo Visuals</p>
      </div>
    </div>
  `;

const pdfHtml = `
    <html>
    <head>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #333; margin: 40px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        .header-table { margin-bottom: 40px; }
        .header-table td { vertical-align: top; }
        .logo-col { width: 50%; }
        .title-col { width: 50%; text-align: right; }
        .title-col h1 { margin: 0; font-size: 26px; font-weight: normal; color: #333; line-height: 1.2; }
        .invoice-id { margin-top: 5px; font-size: 14px; color: #777; }
        .company-info { margin-top: 15px; font-size: 12px; color: #222; line-height: 1.5; }
        .meta-table { margin-bottom: 30px; }
        .meta-table td { vertical-align: top; }
        .bill-to h3 { margin: 0 0 5px 0; font-size: 13px; font-weight: normal; color: #777; text-transform: uppercase; }
        .bill-to p { margin: 0 0 3px 0; font-size: 14px; font-weight: bold; }
        .bill-to span { display: block; margin-bottom: 2px; font-weight: normal; color: #444; }
        .summary-box { float: right; width: 260px; }
        .summary-box table { width: 100%; }
        .summary-box td { padding: 6px 10px; text-align: right; }
        .balance-row td { background-color: #f4f4f4; font-weight: bold; }
        .items-table { margin-top: 10px; width: 100%; }
        .items-table td { padding: 12px 10px; border-bottom: 1px solid #eee; text-align: right; vertical-align: top; }
        .items-table td.col-left { text-align: left; }
        .total-container { width: 100%; margin-top: 20px; overflow: hidden; }
        .total-box { float: right; width: 200px; }
        .total-box td { padding: 5px 10px; text-align: right; font-size: 13px; }
        .notes { margin-top: 40px; font-size: 12px; color: #444; line-height: 1.6; }
        .notes-title { color: #888; font-size: 11px; text-transform: uppercase; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td class="logo-col">
            <img src="${logoData}" style="max-width: 140px;">
            <div class="company-info">
              <strong>Vertigo Visuals | Joseph Gerges</strong><br>
              <a href="https://www.google.com/maps/place/VV+Podcast+Studio/@-33.99295,150.8825607,16z/data=!4m6!3m5!1s0x6b12eb627eb32a41:0x1d9f8a29ef1452af!8m2!3d-33.992871!4d150.8824306!16s%2Fg%2F11y4yd08qy?entry=ttu&g_ep=EgoyMDI2MDQwNy4wIKXMDSoASAFQAw%3D%3D" style="color: #222; text-decoration: none;">Studio Location (Google Maps)</a><br>
              contact@vertigovisuals.com.au<br>
              ABN: 97 592 829 541
            </div>
          </td>
          <td class="title-col">
            <h1>Vertigo Visuals<br>${invoiceTitle}</h1>
            <div class="invoice-id"># ${invoiceNumber}</div>
          </td>
        </tr>
      </table>

      <table class="meta-table">
        <tr>
          <td class="bill-to">
            <h3>Bill To:</h3>
            <p>${safeName}</p>
            ${safeAccountName ? `<span>${safeAccountName}</span>` : ""}
            ${safeAbn ? `<span>ABN: ${safeAbn}</span>` : ""}
            <span>${safeEmail}</span>
            ${safePhone ? `<span>${safePhone}</span>` : ""}
          </td>
          <td>
            <div class="summary-box">
              <table>
                <tr><td style="color: #777;">Date:</td><td>${invoiceDate}</td></tr>
                <tr><td style="color: #777; font-weight:bold;">Due Date:</td><td style="font-weight:bold;">${dueDate}</td></tr>
                <tr class="balance-row"><td>Balance Due:</td><td>A$${total}.00</td></tr>
              </table>
            </div>
          </td>
        </tr>
      </table>

      <table class="items-table">
        <tr style="background-color: #333; color: #fff;">
          <th style="padding: 8px 10px; font-size: 12px; text-align: left;">Item</th>
          <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Quantity</th>
          <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Rate</th>
          <th style="padding: 8px 10px; font-size: 12px; text-align: right;">Amount</th>
        </tr>
        <tr>
          <td class="col-left">
            <strong>Podcast Studio Hire (${safeDuration})</strong><br>
            <span style="font-size:11px; color:#666;">Booking: ${bookingDate} | Format: ${safeFormat}</span>
          </td>
          <td>1</td>
          <td>A$${baseAmount}.00</td>
          <td>A$${baseAmount}.00</td>
        </tr>
        ${
					addOnsFormatted
						? `
          <tr>
            <td class="col-left">
              <strong>Add-Ons</strong><br>
              <span style="font-size:11px; color:#666;">${addOnsFormatted}</span>
            </td>
            <td>1</td>
            <td>A$${totalAddOns}.00</td>
            <td>A$${totalAddOns}.00</td>
          </tr>
        `
						: ""
				}
        <tr>
          <td class="col-left"><strong>Deposit Paid</strong></td>
          <td>1</td>
          <td>-A$50.00</td>
          <td>-A$50.00</td>
        </tr>
      </table>

      <div class="total-container">
        <table class="total-box">
          <tr>
            <td style="color:#777; font-weight:normal;">Total:</td>
            <td style="font-weight:bold;">A$${total}.00</td>
          </tr>
        </table>
      </div>

      <div class="notes">
        <table style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <div class="notes-title">Payment Methods</div>
              <strong>Bank Transfer</strong><br>BSB: 082-124<br>Acc: 432849833<br><br>
              <strong>PayID</strong><br>0434367184
            </td>
            <td style="width: 50%; vertical-align: top; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #333;">
              <span style="font-size:13px; color:#000;">
                <strong>Due:</strong> End of day on ${dueDate}<br><br>
                <strong>Payment:</strong> Settle early via Bank Transfer / PayID, or pay in-studio.<br><br>
              </span>
              <span style="font-size:11px; color:#555;">
                <em>*If transferring on the day, please email the receipt.</em>
              </span>
            </td>
          </tr>
        </table>
        <span style="font-size:11px; color:#777;"><em>Cancellation Policy: The $50 booking deposit is non-refundable if the session is cancelled within 48 hours of the scheduled start time.</em></span>
      </div>
    </body>
    </html>
  `;
