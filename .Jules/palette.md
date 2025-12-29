## 2024-05-23 - [Keyboard Accessible File Dropzone]
**Learning:** File upload dropzones that rely solely on `click` events on a container (div) and a hidden file input are inaccessible to keyboard users. Using `display: none` (`className="hidden"`) on the input removes it from the accessibility tree, making it impossible to focus.
**Action:** When creating a custom file upload UI, ensure the container has `tabIndex={0}`, `role="button"`, and an `onKeyDown` handler (Enter/Space) to trigger the hidden input click. Alternatively, keep the file input in the DOM but visually hidden (e.g., `opacity: 0`) and positioned over the container, so it handles focus and activation natively.

## 2024-05-25 - [Accessible Copy Feedback]
**Learning:** Icon-only copy buttons often lack both accessible labels and visual confirmation. Users need immediate feedback that the copy action succeeded, and screen readers need to know what the button does.
**Action:** Always add `aria-label` to icon-only buttons. For copy actions, implement a temporary state change (e.g., swapping the 'Copy' icon for a 'Check' icon) to provide visual confirmation of success.
