# Fix product FAQs in Admin

## Goal
Make saved product FAQs that already appear on the website also load inside the matching product’s Admin edit form.

## Changes
- Normalize FAQ data returned in array, JSON-text, double-encoded, or older question/answer formats.
- Apply that normalization while loading products and again when opening a product for editing.
- Keep existing FAQ add, edit, remove, and save behavior unchanged.
- Verify the Admin code passes checks and that live FAQ data is recognized correctly.

## Technical details
The fix stays in the product Admin screen and does not change the database or public product page.
