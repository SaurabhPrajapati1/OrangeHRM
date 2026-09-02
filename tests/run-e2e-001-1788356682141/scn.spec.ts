import { test, expect } from '@playwright/test';

const BASE_URL = 'https://demo-shop.example.com';

test.describe('SCN', () => {

  // Register new user via UI with valid details
  test('Register new user via UI with valid details', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // Verify registration page loads with required fields
    const nameField = page.getByTestId('register-name-input').or(page.getByRole('textbox', { name: /name/i }));
    const emailField = page.getByTestId('register-email-input').or(page.getByRole('textbox', { name: /email/i }));
    const passwordField = page.getByTestId('register-password-input').or(page.locator('input[type="password"]').first());
    const confirmPasswordField = page.getByTestId('register-confirm-password-input').or(page.locator('input[type="password"]').nth(1));

    await expect(nameField).toBeVisible();
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(confirmPasswordField).toBeVisible();

    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const strongPassword = 'StrongP@ssw0rd123!';

    await nameField.fill('Test User');
    await emailField.fill(uniqueEmail);
    await passwordField.fill(strongPassword);
    await confirmPasswordField.fill(strongPassword);

    // No validation errors should be visible before submit
    const validationError = page.getByTestId('register-validation-error');
    await expect(validationError).toHaveCount(0);

    const registerButton = page.getByTestId('register-submit-button').or(page.getByRole('button', { name: /register/i }));
    await registerButton.click();

    // Verify success message or redirect to login/dashboard
    const successMessage = page.getByTestId('register-success-message');
    const successVisible = await successMessage.isVisible().catch(() => false);

    if (successVisible) {
      await expect(successMessage).toContainText(/success|created|welcome/i);
    } else {
      await expect(page).toHaveURL(/\/(login|dashboard)/);
    }
  });

  // Login fails with incorrect password via UI
  test('Login fails with incorrect password via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const emailField = page.getByTestId('login-email-input').or(page.getByRole('textbox', { name: /email/i }));
    const passwordField = page.getByTestId('login-password-input').or(page.locator('input[type="password"]'));

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();

    await emailField.fill('registered.user@example.com');
    await passwordField.fill('WrongPassword123!');

    const loginButton = page.getByTestId('login-submit-button').or(page.getByRole('button', { name: /login/i }));
    await loginButton.click();

    // Verify error message is displayed
    const errorMessage = page.getByTestId('login-error-message').or(page.getByText(/invalid email or password/i));
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/invalid|incorrect|email or password/i);

    // User remains on login page
    await expect(page).toHaveURL(/\/login/);
  });

  // Filter products by single category via UI
  test('Filter products by single category via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const productCards = page.getByTestId('product-card');
    await expect(productCards.first()).toBeVisible();

    const categoryFilter = page.getByTestId('category-filter-Electronics').or(
      page.getByRole('checkbox', { name: /electronics/i }).or(page.getByRole('link', { name: /electronics/i }))
    );
    await expect(categoryFilter).toBeVisible();
    await categoryFilter.click();

    await page.waitForLoadState('networkidle');

    // Verify only Electronics category products are shown
    const filteredCards = page.getByTestId('product-card');
    const count = await filteredCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const categoryLabel = filteredCards.nth(i).getByTestId('product-category-label');
      await expect(categoryLabel).toHaveText(/electronics/i);
    }

    // Clear the filter
    const clearFilterButton = page.getByTestId('clear-filter-button').or(page.getByRole('button', { name: /clear/i }));
    await clearFilterButton.click();

    await page.waitForLoadState('networkidle');

    const allProductCards = page.getByTestId('product-card');
    const allCount = await allProductCards.count();
    expect(allCount).toBeGreaterThanOrEqual(count);
  });

  // Combine category filter with search keyword
  test('Combine category filter with search keyword', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const categoryFilter = page.getByTestId('category-filter-Clothing').or(
      page.getByRole('checkbox', { name: /clothing/i }).or(page.getByRole('link', { name: /clothing/i }))
    );
    await expect(categoryFilter).toBeVisible();
    await categoryFilter.click();

    await page.waitForLoadState('networkidle');

    const searchBox = page.getByTestId('product-search-input').or(page.getByRole('textbox', { name: /search/i }));
    await expect(searchBox).toBeVisible();
    await searchBox.fill('shirt');
    await searchBox.press('Enter');

    await page.waitForLoadState('networkidle');

    const filteredCards = page.getByTestId('product-card');
    const count = await filteredCards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const categoryLabel = filteredCards.nth(i).getByTestId('product-category-label');
        const productTitle = filteredCards.nth(i).getByTestId('product-title');

        await expect(categoryLabel).toHaveText(/clothing/i);
        await expect(productTitle).toContainText(/shirt/i);
      }
    } else {
      const noResultsMessage = page.getByTestId('no-products-message');
      await expect(noResultsMessage).toBeVisible();
    }
  });

  // Complete checkout successfully with valid test-mode payment details
  test('Complete checkout successfully with valid test-mode payment details', async ({ page }) => {
    await page.goto(`${BASE_URL}/cart`);

    const proceedToCheckoutButton = page.getByTestId('proceed-to-checkout-button').or(page.getByRole('button', { name: /proceed to checkout/i }));
    await expect(proceedToCheckoutButton).toBeVisible();
    await proceedToCheckoutButton.click();

    await expect(page).toHaveURL(/\/checkout/);

    // Verify checkout page sections load
    const orderSummary = page.getByTestId('order-summary-section');
    const shippingSection = page.getByTestId('shipping-section');
    const paymentSection = page.getByTestId('payment-section');

    await expect(orderSummary).toBeVisible();
    await expect(shippingSection).toBeVisible();
    await expect(paymentSection).toBeVisible();

    // Enter shipping address details
    await page.getByTestId('shipping-full-name-input').or(page.getByRole('textbox', { name: /full name/i })).fill('Test User');
    await page.getByTestId('shipping-address-input').or(page.getByRole('textbox', { name: /address/i })).fill('123 Test Street');
    await page.getByTestId('shipping-city-input').or(page.getByRole('textbox', { name: /city/i })).fill('Test City');
    await page.getByTestId('shipping-postal-code-input').or(page.getByRole('textbox', { name: /postal code|zip/i })).fill('12345');
    await page.getByTestId('shipping-country-select').or(page.getByRole('combobox', { name: /country/i })).selectOption({ index: 1 });

    // Enter test-mode payment card details
    const cardNumberField = page.getByTestId('payment-card-number-input').or(page.getByRole('textbox', { name: /card number/i }));
    const cardExpiryField = page.getByTestId('payment-card-expiry-input').or(page.getByRole('textbox', { name: /expiry/i }));
    const cardCvcField = page.getByTestId('payment-card-cvc-input').or(page.getByRole('textbox', { name: /cvc|cvv/i }));

    await cardNumberField.fill('4242424242424242');
    await cardExpiryField.fill('12/30');
    await cardCvcField.fill('123');

    const validationError = page.getByTestId('payment-validation-error');
    await expect(validationError).toHaveCount(0);

    const placeOrderButton = page.getByTestId('place-order-button').or(page.getByRole('button', { name: /place order|confirm payment/i }));
    await placeOrderButton.click();

    // Verify order confirmation page
    await expect(page).toHaveURL(/\/(order-confirmation|confirmation)/);

    const orderNumber = page.getByTestId('order-number');
    const orderStatus = page.getByTestId('order-status');

    await expect(orderNumber).toBeVisible();
    await expect(orderStatus).toContainText(/confirmed|processing/i);
  });

  // UI blocks adding out-of-stock product to cart
  test('UI blocks adding out-of-stock product to cart', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/out-of-stock-item`);

    // Verify Out of Stock label is visible
    const outOfStockLabel = page.getByTestId('out-of-stock-label').or(page.getByText(/out of stock/i));
    await expect(outOfStockLabel).toBeVisible();

    // Verify Add to Cart button state
    const addToCartButton = page.getByTestId('add-to-cart-button').or(page.getByRole('button', { name: /add to cart/i }));
    const notifyMeButton = page.getByTestId('notify-me-button').or(page.getByRole('button', { name: /notify me/i }));

    const addToCartVisible = await addToCartButton.isVisible().catch(() => false);

    if (addToCartVisible) {
      await expect(addToCartButton).toBeDisabled();

      // Attempt to click if not fully disabled (force click to test behavior)
      const isDisabled = await addToCartButton.isDisabled();
      if (!isDisabled) {
        await addToCartButton.click();
        const errorMessage = page.getByTestId('out-of-stock-error-message').or(page.getByText(/currently out of stock/i));
        await expect(errorMessage).toBeVisible();
      }
    } else {
      await expect(notifyMeButton).toBeVisible();
    }

    // Verify cart remains unchanged
    await page.goto(`${BASE_URL}/cart`);
    const outOfStockCartItem = page.getByTestId('cart-item-out-of-stock-item');
    await expect(outOfStockCartItem).toHaveCount(0);
  });

});
