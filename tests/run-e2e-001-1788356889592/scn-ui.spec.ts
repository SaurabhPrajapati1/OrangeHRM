import { test, expect } from '@playwright/test';

const BASE_URL = 'https://demo-shop.example.com';

test.describe('SCN', () => {

  // Test Case: Register new user via UI with valid details
  test('Register new user via UI with valid details', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // Verify registration page loads with required fields
    const nameField = page.getByTestId('register-name').or(page.getByLabel(/name/i)).or(page.locator('input[name="name"]'));
    const emailField = page.getByTestId('register-email').or(page.getByLabel(/email/i)).or(page.locator('input[name="email"]'));
    const passwordField = page.getByTestId('register-password').or(page.getByLabel(/^password$/i)).or(page.locator('input[name="password"]'));
    const confirmPasswordField = page.getByTestId('register-confirm-password').or(page.getByLabel(/confirm password/i)).or(page.locator('input[name="confirmPassword"]'));

    await expect(nameField).toBeVisible();
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(confirmPasswordField).toBeVisible();

    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const strongPassword = 'StrongP@ssw0rd123';

    await nameField.fill('Test User');
    await emailField.fill(uniqueEmail);
    await passwordField.fill(strongPassword);
    await confirmPasswordField.fill(strongPassword);

    // Verify no validation errors are shown before submit
    const validationError = page.getByTestId('validation-error').or(page.locator('.error-message'));
    await expect(validationError).toHaveCount(0);

    const registerButton = page.getByTestId('register-submit').or(page.getByRole('button', { name: /register/i }));
    await registerButton.click();

    // Verify success message or redirect to login/dashboard
    const successMessage = page.getByTestId('register-success').or(page.getByText(/registration successful|account created/i));
    await expect(successMessage.or(page)).toBeTruthy();

    await page.waitForURL(/(login|dashboard)/, { timeout: 10000 }).catch(() => {});
    const isRedirected = /login|dashboard/.test(page.url());
    const isSuccessVisible = await successMessage.isVisible().catch(() => false);

    expect(isRedirected || isSuccessVisible).toBeTruthy();
  });

  // Test Case: Login fails with incorrect password via UI
  test('Login fails with incorrect password via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const emailField = page.getByTestId('login-email').or(page.getByLabel(/email/i)).or(page.locator('input[name="email"]'));
    const passwordField = page.getByTestId('login-password').or(page.getByLabel(/password/i)).or(page.locator('input[name="password"]'));

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();

    await emailField.fill('registered.user@example.com');
    await passwordField.fill('WrongPassword123!');

    const loginButton = page.getByTestId('login-submit').or(page.getByRole('button', { name: /login|sign in/i }));
    await loginButton.click();

    // Verify error message is displayed
    const errorMessage = page.getByTestId('login-error').or(page.getByText(/invalid email or password/i));
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Verify user remains on login page
    await expect(page).toHaveURL(/login/);
  });

  // Test Case: Filter products by single category via UI
  test('Filter products by single category via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    // Verify product catalogue and filter panel are visible
    const filterPanel = page.getByTestId('category-filter').or(page.getByRole('navigation', { name: /categor(y|ies)/i }));
    await expect(filterPanel).toBeVisible();

    const productCards = page.getByTestId('product-card').or(page.locator('.product-card'));
    const initialCount = await productCards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Select 'Electronics' category filter
    const electronicsFilter = page.getByTestId('category-electronics').or(page.getByRole('button', { name: /electronics/i })).or(page.getByText('Electronics', { exact: true }));
    await electronicsFilter.click();

    await page.waitForLoadState('networkidle');

    // Verify all displayed products belong to Electronics category
    const filteredProducts = page.getByTestId('product-card').or(page.locator('.product-card'));
    const filteredCount = await filteredProducts.count();
    expect(filteredCount).toBeGreaterThan(0);

    for (let i = 0; i < filteredCount; i++) {
      const categoryLabel = filteredProducts.nth(i).getByTestId('product-category').or(filteredProducts.nth(i).locator('.product-category'));
      await expect(categoryLabel).toContainText(/electronics/i);
    }

    // Clear the filter
    const clearFilterButton = page.getByTestId('clear-filter').or(page.getByRole('button', { name: /clear filter/i }));
    await clearFilterButton.click();

    await page.waitForLoadState('networkidle');

    const allProducts = page.getByTestId('product-card').or(page.locator('.product-card'));
    const allCount = await allProducts.count();
    expect(allCount).toBeGreaterThanOrEqual(initialCount);
  });

  // Test Case: Combine category filter with search keyword
  test('Combine category filter with search keyword', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    // Select 'Clothing' category filter
    const clothingFilter = page.getByTestId('category-clothing').or(page.getByRole('button', { name: /clothing/i })).or(page.getByText('Clothing', { exact: true }));
    await clothingFilter.click();

    await page.waitForLoadState('networkidle');

    const clothingProducts = page.getByTestId('product-card').or(page.locator('.product-card'));
    const clothingCount = await clothingProducts.count();
    expect(clothingCount).toBeGreaterThan(0);

    // Enter search keyword
    const searchBox = page.getByTestId('search-input').or(page.getByPlaceholder(/search/i)).or(page.locator('input[type="search"]'));
    await searchBox.fill('shirt');
    await searchBox.press('Enter');

    await page.waitForLoadState('networkidle');

    // Verify combined filter results
    const combinedResults = page.getByTestId('product-card').or(page.locator('.product-card'));
    const combinedCount = await combinedResults.count();

    for (let i = 0; i < combinedCount; i++) {
      const productItem = combinedResults.nth(i);
      const categoryLabel = productItem.getByTestId('product-category').or(productItem.locator('.product-category'));
      const productName = productItem.getByTestId('product-name').or(productItem.locator('.product-name'));

      await expect(categoryLabel).toContainText(/clothing/i);
      await expect(productName).toContainText(/shirt/i);
    }

    expect(combinedCount).toBeLessThanOrEqual(clothingCount);
  });

  // Test Case: Complete checkout successfully with valid test-mode payment details
  test('Complete checkout successfully with valid test-mode payment details', async ({ page }) => {
    await page.goto(`${BASE_URL}/cart`);

    const checkoutButton = page.getByTestId('proceed-to-checkout').or(page.getByRole('button', { name: /proceed to checkout/i }));
    await checkoutButton.click();

    // Verify checkout page loads with required sections
    const orderSummary = page.getByTestId('order-summary').or(page.getByRole('region', { name: /order summary/i }));
    const shippingSection = page.getByTestId('shipping-section').or(page.getByRole('region', { name: /shipping/i }));
    const paymentSection = page.getByTestId('payment-section').or(page.getByRole('region', { name: /payment/i }));

    await expect(orderSummary).toBeVisible();
    await expect(shippingSection).toBeVisible();
    await expect(paymentSection).toBeVisible();

    // Enter shipping address details
    const addressLine1 = page.getByTestId('shipping-address-line1').or(page.getByLabel(/address line 1/i));
    const city = page.getByTestId('shipping-city').or(page.getByLabel(/city/i));
    const postalCode = page.getByTestId('shipping-postal-code').or(page.getByLabel(/postal code|zip/i));
    const country = page.getByTestId('shipping-country').or(page.getByLabel(/country/i));

    await addressLine1.fill('123 Test Street');
    await city.fill('Testville');
    await postalCode.fill('12345');
    if (await country.isVisible().catch(() => false)) {
      await country.selectOption({ label: 'United States' }).catch(async () => {
        await country.fill('United States');
      });
    }

    // Enter valid test-mode payment card details
    const cardNumber = page.getByTestId('payment-card-number').or(page.getByLabel(/card number/i));
    const cardExpiry = page.getByTestId('payment-card-expiry').or(page.getByLabel(/expiry/i));
    const cardCvc = page.getByTestId('payment-card-cvc').or(page.getByLabel(/cvc|cvv/i));

    await cardNumber.fill('4242424242424242');
    await cardExpiry.fill('12/30');
    await cardCvc.fill('123');

    const validationError = page.getByTestId('payment-validation-error').or(page.locator('.payment-error'));
    await expect(validationError).toHaveCount(0);

    // Place the order
    const placeOrderButton = page.getByTestId('place-order').or(page.getByRole('button', { name: /place order|confirm payment/i }));
    await placeOrderButton.click();

    // Verify order confirmation page
    await page.waitForURL(/confirmation|order-success/i, { timeout: 15000 }).catch(() => {});

    const orderConfirmation = page.getByTestId('order-confirmation').or(page.getByText(/order confirmed|thank you/i));
    const orderNumber = page.getByTestId('order-number').or(page.getByText(/order #|order number/i));
    const orderStatus = page.getByTestId('order-status').or(page.getByText(/confirmed|processing/i));

    await expect(orderConfirmation).toBeVisible({ timeout: 15000 });
    await expect(orderNumber).toBeVisible();
    await expect(orderStatus).toBeVisible();
  });

  // Test Case: UI blocks adding out-of-stock product to cart
  test('UI blocks adding out-of-stock product to cart', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/out-of-stock-item`);

    // Verify out-of-stock status is displayed
    const stockStatus = page.getByTestId('stock-status').or(page.getByText(/out of stock/i));
    await expect(stockStatus).toBeVisible();

    // Verify Add to Cart button state
    const addToCartButton = page.getByTestId('add-to-cart').or(page.getByRole('button', { name: /add to cart/i }));
    const notifyMeButton = page.getByTestId('notify-me').or(page.getByRole('button', { name: /notify me/i }));

    const isAddToCartVisible = await addToCartButton.isVisible().catch(() => false);

    if (isAddToCartVisible) {
      await expect(addToCartButton).toBeDisabled();

      // Attempt to click if not fully disabled (should be a no-op due to disabled state)
      const isDisabled = await addToCartButton.isDisabled();
      if (!isDisabled) {
        await addToCartButton.click();
        const warningMessage = page.getByTestId('out-of-stock-warning').or(page.getByText(/currently out of stock/i));
        await expect(warningMessage).toBeVisible();
      }
    } else {
      await expect(notifyMeButton.or(stockStatus)).toBeVisible();
    }

    // Verify cart contents remain unchanged
    const cartIcon = page.getByTestId('cart-icon').or(page.getByRole('link', { name: /cart/i }));
    await cartIcon.click();

    const cartItems = page.getByTestId('cart-item').or(page.locator('.cart-item'));
    const outOfStockItemInCart = cartItems.filter({ hasText: /out-of-stock-item/i });
    await expect(outOfStockItemInCart).toHaveCount(0);
  });

});
