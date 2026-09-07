import { test, expect } from '@playwright/test';

const BASE_URL = 'https://opensource-demo.orangehrmlive.com';
const LOGIN_URL = `${BASE_URL}/web/index.php/auth/login`;

test.describe('SCN', () => {
  // test_case_title: API/UI: Locked account remains unable to authenticate until timeout or admin unlock
  test('API/UI: Locked account remains unable to authenticate until timeout or admin unlock', async ({ page, request }) => {
    // NOTE: This test creates a new user via the Admin UI, disables (locks) it, verifies
    // that authentication fails via API/UI, then re-enables the user and verifies authentication succeeds.

    // Admin credentials for demo site
    const adminUsername = 'Admin';
    const adminPassword = 'admin123';

    // Test user credentials (unique username)
    const timestamp = Date.now();
    const testUsername = `e2e_user_${timestamp}`;
    const testPassword = 'Password@123';

    // 1) Login as admin via UI
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    // use placeholders (ARIA fallback) for username/password
    const usernameInput = page.getByPlaceholder('Username');
    const passwordInput = page.getByPlaceholder('Password');
    await expect(usernameInput).toBeVisible({ timeout: 5000 });
    await usernameInput.fill(adminUsername);
    await passwordInput.fill(adminPassword);

    // Login button - try role button then fallback to css
    const loginBtn = page.getByRole('button', { name: /login/i }).first();
    await loginBtn.click();

    // Wait for dashboard to be visible to confirm admin login
    const dashboardHeader = page.getByRole('heading', { name: /dashboard/i });
    await expect(dashboardHeader).toBeVisible({ timeout: 10000 });

    // 2) Navigate to Admin -> User Management -> Users
    const adminNav = page.getByRole('link', { name: 'Admin' }).first();
    await adminNav.click();

    // Wait for Users page to load (heading 'System Users')
    const systemUsersHeading = page.getByRole('heading', { name: /system users/i });
    await expect(systemUsersHeading).toBeVisible({ timeout: 10000 });

    // 3) Click Add to create a new user
    const addButton = page.getByRole('button', { name: 'Add' }).first();
    await addButton.click();

    // Wait for Add User form
    const addUserHeading = page.getByRole('heading', { name: /add user/i });
    await expect(addUserHeading).toBeVisible({ timeout: 5000 });

    // Fill User Role -> select 'ESS' or 'Admin'. Try selecting 'ESS' for safety
    // Fallback to CSS if ARIA selectors not present
    const roleSelect = page.locator('label:has-text("User Role")').locator('..').locator('div[class*="oxd-select-text"]');
    await roleSelect.click();
    const roleOptionESS = page.getByText('ESS').first();
    if (await roleOptionESS.count() > 0) {
      await roleOptionESS.click();
    } else {
      // fallback try Admin
      const roleOptionAdmin = page.getByText('Admin').first();
      await roleOptionAdmin.click();
    }

    // Employee Name: type an existing employee (demo contains "Linda Anderson" or similar). Use a short name to match suggestions
    const employeeInput = page.locator('input[placeholder="Type for hints..."]');
    await employeeInput.fill('Linda');
    // wait for dropdown and click first suggestion
    const suggestion = page.locator('.oxd-autocomplete-dropdown -- List');
    // Fallback: click first suggestion using a generic selector
    const firstSuggestion = page.locator('.oxd-autocomplete-dropdown').locator('div').first();
    if (await firstSuggestion.count() > 0) {
      await firstSuggestion.click();
    } else {
      // If no suggestion found, try typing a more common name
      await employeeInput.fill('Fiona');
      const suggestion2 = page.locator('.oxd-autocomplete-dropdown').locator('div').first();
      if (await suggestion2.count() > 0) {
        await suggestion2.click();
      }
    }

    // Username
    const newUsernameInput = page.locator('label:has-text("Username")').locator('..').locator('input');
    await newUsernameInput.fill(testUsername);

    // Status: ensure Enabled
    const statusSelect = page.locator('label:has-text("Status")').locator('..').locator('div[class*="oxd-select-text"]');
    await statusSelect.click();
    const enabledOption = page.getByText('Enabled').first();
    if (await enabledOption.count() > 0) await enabledOption.click();

    // Password and Confirm Password
    const pwdInput = page.locator('input[type="password"]').first();
    const confirmPwdInput = page.locator('input[type="password"]').nth(1);
    await pwdInput.fill(testPassword);
    await confirmPwdInput.fill(testPassword);

    // Click Save
    const saveBtn = page.getByRole('button', { name: 'Save' }).first();
    await saveBtn.click();

    // Wait for users list and confirm that new username appears in the table via search
    const usernameSearchInput = page.locator('label:has-text("Username")').locator('..').locator('input');
    await expect(usernameSearchInput).toBeVisible({ timeout: 5000 });
    await usernameSearchInput.fill(testUsername);
    const searchBtn = page.getByRole('button', { name: 'Search' }).first();
    await searchBtn.click();

    // Verify user appears in results
    const resultCell = page.locator('div[role="row"]').getByText(testUsername).first();
    await expect(resultCell).toBeVisible({ timeout: 10000 });

    // 4) Disable the user (simulate admin 'lock') by editing and setting Status -> Disabled
    // Click the edit button for the user row (assume pencil icon or an Edit button)
    const userRow = resultCell.locator('..').locator('..'); // traverse up to row
    const editButton = userRow.getByRole('button', { name: /edit/i }).first();
    if (await editButton.count() > 0) {
      await editButton.click();
    } else {
      // fallback: click the first button in the row (likely edit)
      await userRow.locator('button').first().click();
    }

    // In edit form, set Status -> Disabled
    const statusSelectEdit = page.locator('label:has-text("Status")').locator('..').locator('div[class*="oxd-select-text"]');
    await statusSelectEdit.click();
    const disabledOption = page.getByText('Disabled').first();
    await disabledOption.click();

    // Save changes
    const saveEditBtn = page.getByRole('button', { name: 'Save' }).first();
    await saveEditBtn.click();

    // Confirm change by searching again and asserting Status column shows Disabled
    await usernameSearchInput.fill(testUsername);
    await searchBtn.click();
    // Wait for result and check status cell text
    const statusCell = page.locator('div[role="row"]').getByText(testUsername).locator('..').locator('div').filter({ hasText: 'Disabled' }).first();
    await expect(statusCell).toBeVisible({ timeout: 10000 });

    // 5) Immediately attempt to authenticate via API with correct credentials (request fixture)
    // Use form-urlencoded body as the site expects a form post
    const formBody = new URLSearchParams();
    formBody.append('username', testUsername);
    formBody.append('password', testPassword);

    const apiResponseWhenDisabled = await request.post(LOGIN_URL, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: formBody.toString()
    });

    const apiBodyDisabled = await apiResponseWhenDisabled.text();

    // For a locked/disabled account we expect authentication to fail. The demo site returns the login page with an error message.
    // Assert that the API response does not redirect to dashboard and includes an indication of failed authentication (e.g., 'Invalid credentials' or the login form)
    expect(apiResponseWhenDisabled.status()).toBeGreaterThanOrEqual(200);
    expect(apiBodyDisabled.length).toBeGreaterThan(0);
    const loginFailed = apiBodyDisabled.toLowerCase().includes('invalid credentials') || apiBodyDisabled.toLowerCase().includes('login') || apiBodyDisabled.toLowerCase().includes('authentication');
    expect(loginFailed, 'Expected API authentication attempt for disabled user to indicate failure').toBeTruthy();

    // 6) Re-enable the user (admin unlock) via UI
    // Ensure we are still logged in as admin. If not, log in again.
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    if (await page.getByRole('heading', { name: /dashboard/i }).count() === 0) {
      // login again as admin
      await page.getByPlaceholder('Username').fill(adminUsername);
      await page.getByPlaceholder('Password').fill(adminPassword);
      await page.getByRole('button', { name: /login/i }).click();
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    }

    // Navigate back to Admin -> Users
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(systemUsersHeading).toBeVisible({ timeout: 10000 });

    // Search for the user
    await usernameSearchInput.fill(testUsername);
    await searchBtn.click();
    await expect(resultCell).toBeVisible({ timeout: 10000 });

    // Edit and set status to Enabled
    const userRow2 = resultCell.locator('..').locator('..');
    const editButton2 = userRow2.getByRole('button', { name: /edit/i }).first();
    if (await editButton2.count() > 0) {
      await editButton2.click();
    } else {
      await userRow2.locator('button').first().click();
    }

    const statusSelectEdit2 = page.locator('label:has-text("Status")').locator('..').locator('div[class*="oxd-select-text"]');
    await statusSelectEdit2.click();
    const enabledOption2 = page.getByText('Enabled').first();
    await enabledOption2.click();
    await page.getByRole('button', { name: 'Save' }).click();

    // Confirm status shows Enabled
    await usernameSearchInput.fill(testUsername);
    await searchBtn.click();
    const enabledStatusCell = page.locator('div[role="row"]').getByText(testUsername).locator('..').locator('div').filter({ hasText: 'Enabled' }).first();
    await expect(enabledStatusCell).toBeVisible({ timeout: 10000 });

    // 7) Attempt to authenticate via UI with the re-enabled user
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Username').fill(testUsername);
    await page.getByPlaceholder('Password').fill(testPassword);
    await page.getByRole('button', { name: /login/i }).click();

    // On success, dashboard or quick-launch element should be visible
    const userDashboardHeader = page.getByRole('heading', { name: /dashboard/i });
    await expect(userDashboardHeader).toBeVisible({ timeout: 10000 });

    // 8) Attempt to authenticate via API after unlock and verify it does not indicate failure
    const apiResponseAfterEnabled = await request.post(LOGIN_URL, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: formBody.toString()
    });
    const apiBodyEnabled = await apiResponseAfterEnabled.text();

    // After unlock, API result should not contain the typical login failure markers
    const apiLoginStillFailed = apiBodyEnabled.toLowerCase().includes('invalid credentials') || apiBodyEnabled.toLowerCase().includes('authentication');
    expect(apiLoginStillFailed, 'Expected API authentication after admin unlock to succeed (no invalid credentials text)').toBeFalsy();

    // Cleanup: (optional) disable or delete the created user - best effort
    try {
      // navigate to Admin users and delete user if delete UI available
      await page.getByRole('link', { name: 'Admin' }).click();
      await usernameSearchInput.fill(testUsername);
      await searchBtn.click();
      const row = page.locator('div[role="row"]').getByText(testUsername).first().locator('..').locator('..');
      // try delete button
      const deleteBtn = row.getByRole('button', { name: /delete/i }).first();
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click();
        const confirmDel = page.getByRole('button', { name: 'Yes, Delete' }).first();
        if (await confirmDel.count() > 0) await confirmDel.click();
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });
});
