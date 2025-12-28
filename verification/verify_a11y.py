
from playwright.sync_api import sync_playwright

def verify_accessibility():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:9002")

            # Verify file inputs have aria-labels
            hidden_inputs = page.locator('input[type="file"]')
            count = hidden_inputs.count()
            print(f"Found {count} file inputs")

            for i in range(count):
                input_el = hidden_inputs.nth(i)
                aria_label = input_el.get_attribute("aria-label")
                print(f"Input {i} aria-label: {aria_label}")
                if not aria_label:
                    print(f"ERROR: Input {i} missing aria-label")

            # Since we can't easily see aria-labels in a screenshot, we'll verify the focus ring
            # on the FileUpload component in the 'receive' tab of TransferPanel,
            # but to do that we need a connection or just mock the state.
            # However, simpler check: check if we can focus the main file upload on the home page?
            # The home page has opacity-0 inputs.

            # Let's check the TransferPanel (requires steps to reach).
            # It's easier to verify the Home page elements.

            # Focus on the first file upload area
            # The first one is in the hero section "Start by selecting files"
            # It's a div with opacity-0 input.

            # Let's take a screenshot of the homepage
            page.screenshot(path="verification/homepage.png")
            print("Screenshot saved to verification/homepage.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_accessibility()
