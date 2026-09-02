import { test, expect } from '@playwright/test';

const BASE_URL = 'https://demo-shop.example.com';

test.describe('SCN', () => {

  // Register new user via UI with valid details
  test('SCN-001: Register new user via UI with valid details', async ({ page }) => {
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

    // Ensure no validation errors appear before submitting
    const validationError = page.getByTestId('validation-error');
    await expect(validationError).toHaveCount(0);

    const registerButton = page.getByTestId('register-submit-button').or(page.getByRole('button', { name: /register/i }));
    await registerButton.click();

    // Verify success message or redirect to login/dashboard
    const successMessage = page.getByTestId('register-success-message').or(page.getByText(/account created|registration successful/i));
    await expect(page).toHaveURL(/(login|dashboard)/, { timeout: 10000 }).catch(async () => {
      await expect(successMessage).toBeVisible();
    });
  });

  // Login fails with incorrect password via UI
  test('SCN-002: Login fails with incorrect password via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const emailField = page.getByTestId('login-email-input').or(page.getByRole('textbox', { name: /email/i }));
    const passwordField = page.getByTestId('login-password-input').or(page.locator('input[type="password"]'));
    const loginButton = page.getByTestId('login-submit-button').or(page.getByRole('button', { name: /login/i }));

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();

    await emailField.fill('registered.user@example.com');
    await passwordField.fill('WrongPassword123!');

    await loginButton.click();

    const errorMessage = page.getByTestId('login-error-message').or(page.getByText(/invalid email or password/i));
    await expect(errorMessage).toBeVisible();

    // User remains on login page
    await expect(page).toHaveURL(/login/);
  });

  // Filter products by single category via UI
  test('SCN-003: Filter products by single category via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const productCards = page.getByTestId('product-card');
    await expect(productCards.first()).toBeVisible();

    const categoryFilter = page.getByTestId('category-filter-electronics').or(page.getByRole('checkbox', { name: /electronics/i })).or(page.getByLabel(/electronics/i));
    await categoryFilter.click();

    // Wait for products to update
    await page.waitForTimeout(500);

    const filteredCards = page.getByTestId('product-card');
    const count = await filteredCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const categoryLabel = filteredCards.nth(i).getByTestId('product-category-label');
      await expect(categoryLabel).toHaveText(/electronics/i);
    }

    // Clear the filter
    const clearFilterButton = page.getByTestId('clear-filters-button').or(page.getByRole('button', { name: /clear filters?/i }));
    await clearFilterButton.click();

    await page.waitForTimeout(500);
    const allProducts = page.getByTestId('product-card');
    const allCount = await allProducts.count();
    expect(allCount).toBeGreaterThanOrEqual(count);
  });

  // Combine category filter with search keyword
  test('SCN-003: Combine category filter with search keyword', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const categoryFilter = page.getByTestId('category-filter-clothing').or(page.getByRole('checkbox', { name: /clothing/i })).or(page.getByLabel(/clothing/i));
    await categoryFilter.click();

    await page.waitForTimeout(500);

    let productCards = page.getByTestId('product-card');
    const categoryOnlyCount = await productCards.count();
    expect(categoryOnlyCount).toBeGreaterThan(0);

    const searchInput = page.getByTestId('product-search-input').or(page.getByPlaceholder(/search/i));
    await searchInput.fill('shirt');
    await searchInput.press('Enter');

    await page.waitForTimeout(500);

    productCards = page.getByTestId('product-card');
    const combinedCount = await productCards.count();
    expect(combinedCount).toBeLessThanOrEqual(categoryOnlyCount);
    expect(combinedCount).toBeGreaterThan(0);

    for (let i = 0; i < combinedCount; i++) {
      const card = productCards.nth(i);
      const categoryLabel = card.getByTestId('product-category-label');
      const productName = card.getByTestId('product-name');

      await expect(categoryLabel).toHaveText(/clothing/i);
      await expect(productName).toContainText(/shirt/i);
    }
  });

  // Complete checkout successfully with valid test-mode payment details
  test('SCN-004: Complete checkout successfully with valid test-mode payment details', async ({ page }) => {
    await page.goto(`${BASE_URL}/cart`);

    const proceedToCheckoutButton = page.getByTestId('proceed-to-checkout-button').or(page.getByRole('button', { name: /proceed to checkout/i }));
    await proceedToCheckoutButton.click();

    await expect(page).toHaveURL(/checkout/);

    const orderSummary = page.getByTestId('order-summary');
    await expect(orderSummary).toBeVisible();

    // Fill shipping details
    const shippingNameField = page.getByTestId('shipping-name-input');
    const shippingAddressField = page.getByTestId('shipping-address-input');
    const shippingCityField = page.getByTestId('shipping-city-input');
    const shippingPostalCodeField = page.getByTestId('shipping-postal-code-input');
    const shippingCountryField = page.getByTestId('shipping-country-select');

    await shippingNameField.fill('Test User');
    await shippingAddressField.fill('123 Test Street');
    await shippingCityField.fill('Test City');
    await shippingPostalCodeField.fill('12345');
    await shippingCountryField.selectOption({ label: 'United States' }).catch(() => {});

    const continueToPaymentButton = page.getByTestId('continue-to-payment-button').or(page.getByRole('button', { name: /continue|next/i }));
    await continueToPaymentButton.click().catch(() => {});

    // Fill payment details using sandbox test card
    const cardNumberField = page.getByTestId('payment-card-number-input');
    const cardExpiryField = page.getByTestId('payment-card-expiry-input');
    const cardCvcField = page.getByTestId('payment-card-cvc-input');

    await cardNumberField.fill('4242424242424242');
    await cardExpiryField.fill('12/30');
    await cardCvcField.fill('123');

    const validationError = page.getByTestId('payment-validation-error');
    await expect(validationError).toHaveCount(0);

    const placeOrderButton = page.getByTestId('place-order-button').or(page.getByRole('button', { name: /place order|confirm payment/i }));
    await placeOrderButton.click();

    // Verify order confirmation page
    await expect(page).toHaveURL(/order-confirmation|confirmation/, { timeout: 15000 });

    const orderNumber = page.getByTestId('order-number');
    await expect(orderNumber).toBeVisible();

    const orderStatus = page.getByTestId('order-status');
    await expect(orderStatus).toHaveText(/confirmed|processing/i);
  });

  // UI blocks adding out-of-stock product to cart
  test('SCN-005: UI blocks adding out-of-stock product to cart', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/out-of-stock-item`);

    const outOfStockLabel = page.getByTestId('out-of-stock-label').or(page.getByText(/out of stock/i));
    await expect(outOfStockLabel).toBeVisible();

    const addToCartButton = page.getByTestId('add-to-cart-button').or(page.getByRole('button', { name: /add to cart/i }));

    const isDisabled = await addToCartButton.isDisabled().catch(() => false);

    if (isDisabled) {
      await expect(addToCartButton).toBeDisabled();
    } else {
      await addToCartButton.click();
      const warningMessage = page.getByTestId('out-of-stock-warning').or(page.getByText(/currently out of stock/i));
      await expect(warningMessage).toBeVisible();
    }

    // Verify cart contents remain unchanged
    await page.goto(`${BASE_URL}/cart`);
    const cartItems = page.getByTestId('cart-item');
    const outOfStockItemInCart = cartItems.filter({ hasText: /out-of-stock-item/i });
    await expect(outOfStockItemInCart).toHaveCount(0);
  });

});
