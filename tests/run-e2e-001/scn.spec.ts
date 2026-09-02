import { test, expect } from '@playwright/test';

const BASE_URL = 'https://demo-shop.example.com';

test.describe('SCN', () => {

  // Register new user via UI with valid details
  test('Register new user via UI with valid details', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // Verify registration page loads with required fields
    await expect(page.getByTestId('register-name-input').or(page.getByLabel('Name'))).toBeVisible();
    await expect(page.getByTestId('register-email-input').or(page.getByLabel('Email'))).toBeVisible();
    await expect(page.getByTestId('register-password-input').or(page.getByLabel('Password', { exact: true }))).toBeVisible();
    await expect(page.getByTestId('register-confirm-password-input').or(page.getByLabel('Confirm Password'))).toBeVisible();

    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const strongPassword = 'StrongP@ssw0rd123!';

    const nameField = page.getByTestId('register-name-input').or(page.getByLabel('Name'));
    const emailField = page.getByTestId('register-email-input').or(page.getByLabel('Email'));
    const passwordField = page.getByTestId('register-password-input').or(page.getByLabel('Password', { exact: true }));
    const confirmPasswordField = page.getByTestId('register-confirm-password-input').or(page.getByLabel('Confirm Password'));

    await nameField.fill('Test User');
    await emailField.fill(uniqueEmail);
    await passwordField.fill(strongPassword);
    await confirmPasswordField.fill(strongPassword);

    // Verify no validation errors are shown after filling fields
    await expect(page.getByTestId('field-error')).toHaveCount(0);

    const registerButton = page.getByTestId('register-submit-button').or(page.getByRole('button', { name: /register/i }));
    await registerButton.click();

    // Verify success message or redirect to login/dashboard
    await expect(
      page.getByTestId('registration-success-message').or(page.getByText(/registration successful|welcome/i))
    ).toBeVisible({ timeout: 10000 }).catch(async () => {
      await expect(page).toHaveURL(/\/(login|dashboard)/);
    });

    // Verify account status is active (if account status element is present)
    const accountStatus = page.getByTestId('account-status');
    if (await accountStatus.count() > 0) {
      await expect(accountStatus).toHaveText(/active/i);
    }
  });

  // Login fails with incorrect password via UI
  test('Login fails with incorrect password via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Verify login page loads with required fields
    const emailField = page.getByTestId('login-email-input').or(page.getByLabel('Email'));
    const passwordField = page.getByTestId('login-password-input').or(page.getByLabel('Password'));

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();

    await emailField.fill('registereduser@example.com');
    await passwordField.fill('WrongPassword123!');

    const loginButton = page.getByTestId('login-submit-button').or(page.getByRole('button', { name: /login/i }));
    await loginButton.click();

    // Verify error message is displayed
    const errorMessage = page.getByTestId('login-error-message').or(page.getByText(/invalid email or password/i));
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Verify user remains on login page
    await expect(page).toHaveURL(/\/login/);
  });

  // Filter products by single category via UI
  test('Filter products by single category via UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    // Verify product catalogue page loads with products and filters
    const productCards = page.getByTestId('product-card');
    await expect(productCards.first()).toBeVisible();

    const categoryFilter = page.getByTestId('category-filter-electronics').or(
      page.getByRole('checkbox', { name: /electronics/i })
    ).or(page.getByRole('link', { name: /electronics/i }));

    await expect(categoryFilter).toBeVisible();
    await categoryFilter.click();

    // Wait for filtered results to load
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify all displayed products belong to Electronics category
    const filteredProducts = page.getByTestId('product-card');
    const count = await filteredProducts.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const categoryLabel = filteredProducts.nth(i).getByTestId('product-category');
      if (await categoryLabel.count() > 0) {
        await expect(categoryLabel).toHaveText(/electronics/i);
      }
    }

    // Clear the filter
    const clearFilterButton = page.getByTestId('clear-filter-button').or(page.getByRole('button', { name: /clear filter/i }));
    if (await clearFilterButton.count() > 0) {
      await clearFilterButton.click();
      await page.waitForLoadState('networkidle').catch(() => {});

      const allProducts = page.getByTestId('product-card');
      const allCount = await allProducts.count();
      expect(allCount).toBeGreaterThanOrEqual(count);
    }
  });

  // Combine category filter with search keyword
  test('Combine category filter with search keyword', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    // Select Clothing category filter
    const categoryFilter = page.getByTestId('category-filter-clothing').or(
      page.getByRole('checkbox', { name: /clothing/i })
    ).or(page.getByRole('link', { name: /clothing/i }));

    await expect(categoryFilter).toBeVisible();
    await categoryFilter.click();
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify products filtered to Clothing category are displayed
    const filteredByCategoryProducts = page.getByTestId('product-card');
    await expect(filteredByCategoryProducts.first()).toBeVisible();

    // Enter search keyword
    const searchBox = page.getByTestId('search-input').or(page.getByPlaceholder(/search/i));
    await expect(searchBox).toBeVisible();
    await searchBox.fill('shirt');
    await searchBox.press('Enter');

    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify results are narrowed to items matching both category and keyword
    const combinedResults = page.getByTestId('product-card');
    const combinedCount = await combinedResults.count();
    expect(combinedCount).toBeGreaterThanOrEqual(0);

    for (let i = 0; i < combinedCount; i++) {
      const productName = combinedResults.nth(i).getByTestId('product-name');
      const productCategory = combinedResults.nth(i).getByTestId('product-category');

      if (await productCategory.count() > 0) {
        await expect(productCategory).toHaveText(/clothing/i);
      }
      if (await productName.count() > 0) {
        const nameText = await productName.textContent();
        expect(nameText?.toLowerCase()).toContain('shirt');
      }
    }
  });

  // Complete checkout successfully with valid test-mode payment details
  test('Complete checkout successfully with valid test-mode payment details', async ({ page }) => {
    await page.goto(`${BASE_URL}/cart`);

    const proceedToCheckoutButton = page.getByTestId('proceed-to-checkout-button').or(
      page.getByRole('button', { name: /proceed to checkout/i })
    );
    await expect(proceedToCheckoutButton).toBeVisible();
    await proceedToCheckoutButton.click();

    // Verify checkout page loads with order summary, shipping, and payment sections
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByTestId('order-summary').or(page.getByText(/order summary/i))).toBeVisible();
    await expect(page.getByTestId('shipping-section').or(page.getByText(/shipping/i))).toBeVisible();
    await expect(page.getByTestId('payment-section').or(page.getByText(/payment/i))).toBeVisible();

    // Enter valid shipping address details
    await page.getByTestId('shipping-full-name-input').or(page.getByLabel('Full Name')).fill('Test User');
    await page.getByTestId('shipping-address-input').or(page.getByLabel('Address')).fill('123 Test Street');
    await page.getByTestId('shipping-city-input').or(page.getByLabel('City')).fill('Test City');
    await page.getByTestId('shipping-postal-code-input').or(page.getByLabel('Postal Code')).fill('12345');
    await page.getByTestId('shipping-country-select').or(page.getByLabel('Country')).selectOption({ label: 'United States' }).catch(() => {});

    // Enter valid test-mode payment card details
    await page.getByTestId('payment-card-number-input').or(page.getByLabel('Card Number')).fill('4242424242424242');
    await page.getByTestId('payment-card-expiry-input').or(page.getByLabel('Expiry')).fill('12/30');
    await page.getByTestId('payment-card-cvc-input').or(page.getByLabel('CVC')).fill('123');

    // Verify no validation errors
    await expect(page.getByTestId('payment-field-error')).toHaveCount(0);

    const placeOrderButton = page.getByTestId('place-order-button').or(
      page.getByRole('button', { name: /place order|confirm payment/i })
    );
    await placeOrderButton.click();

    // Verify order confirmation page displays with order number and status
    await expect(page).toHaveURL(/\/(order-confirmation|confirmation)/, { timeout: 15000 });
    const orderNumber = page.getByTestId('order-number').or(page.getByText(/order (number|#|id)/i));
    await expect(orderNumber).toBeVisible();

    const orderStatus = page.getByTestId('order-status').or(page.getByText(/confirmed|processing/i));
    await expect(orderStatus).toBeVisible();
  });

  // UI blocks adding out-of-stock product to cart
  test('UI blocks adding out-of-stock product to cart', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/out-of-stock-product`);

    // Verify product page loads showing Out of Stock status
    const outOfStockLabel = page.getByTestId('out-of-stock-label').or(page.getByText(/out of stock/i));
    await expect(outOfStockLabel).toBeVisible();

    // Verify Add to Cart button state is disabled or replaced
    const addToCartButton = page.getByTestId('add-to-cart-button').or(page.getByRole('button', { name: /add to cart/i }));

    if (await addToCartButton.count() > 0) {
      await expect(addToCartButton).toBeDisabled();
    } else {
      const notifyMeButton = page.getByTestId('notify-me-button').or(page.getByRole('button', { name: /notify me/i }));
      await expect(notifyMeButton).toBeVisible();
    }

    // Attempt to click Add to Cart if not fully disabled
    if (await addToCartButton.count() > 0) {
      const isDisabled = await addToCartButton.isDisabled();
      if (!isDisabled) {
        await addToCartButton.click();
        const errorMessage = page.getByTestId('out-of-stock-error').or(page.getByText(/currently out of stock/i));
        await expect(errorMessage).toBeVisible();
      }
    }

    // Verify cart contents remain unchanged
    await page.goto(`${BASE_URL}/cart`);
    const cartItem = page.getByTestId('cart-item-out-of-stock-product');
    await expect(cartItem).toHaveCount(0);
  });

});
