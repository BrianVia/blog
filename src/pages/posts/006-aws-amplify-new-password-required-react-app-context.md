---
layout: "../../layouts/BlogPost.astro"
title: "Solving AWS Amplify NEW_PASSWORD_REQUIRED with React App Context"
description: "No need for Redux, just use App Context."
pubDate: "2024-09-16"
published: true
slug: "006-aws-amplify-new-password-required-react-app-context"
tags: ["react", "aws", "cognito"]
heroImage: {
  src: "/assets/blog/006-aws-amplify-new-password-required-react-app-context/login-error.jpg",
  alt: "A computer screen showing some failed login code.",
  width: 1200,
}
---
## The Problem

I recently ran into a really silly situation trying to use a React UI to login to an Amazon Web Services (AWS) Cognito User Pool.  For my use-case, users are created with a temporary password, and placed into a “Force change password” aka `NEW_PASSWORD_REQUIRED`  state in my AWS Cognito pool.  
<br>
The trouble was, **once I’d login with the temporary password, all of the** `Auth.currentAuthenticatedUser()` or `Auth.userSession()` , et. al. functions would error when trying to fetch from AWS. \n
<br>

I stumbled upon [this github issue](https://github.com/aws-amplify/amplify-js/issues/1340) which directed me to ensure I was handling the `user.challengeName` variable by redirecting to a `/update-password` route in my app. This was a pain but made sense. 

<br>


Once this was implemented, I worked on passing the `CognitoUser` through to the `/update-password` route. Cursor suggested I do it I pass it through URL state, which seemed logical enough for me. 

<br>

After implementing that however, passing the `CognitoUser` to AWS with the `Auth.completeNewPassword(cognitoUser, newPassword)` function kept failing.  “Must be something with passing the object itself through, no problem, I’ll just `JSON.stringify` it on the way in, and `JSON.parse` it on the way out.  But lo and behold when trying to reconstruct the `CognitoUser` and pass it in to `completeNewPassword` and we’d get `user.completeNewPasswordChallenge is not a function`

<br>


[user.completeNewPasswordChallenge is not a function](https://github.com/aws-amplify/amplify-js/issues/1715)

<br>


The github comments seemed to mention that storing the object via Redux or Amplify Cache was the right move. 

[Comment 1](https://github.com/aws-amplify/amplify-js/issues/1715#issuecomment-829513010)
<br>
[Comment 2](https://github.com/aws-amplify/amplify-js/issues/1715#issuecomment-431668104)

<br>

Adding a whole new library just to reset a password seemed ridiculous. Turns out React App Context is just fine!

The below code examples will show you how I did it. It probably could be improved but on the off-hand someone runs into the same issue, maybe this will save them some time.

## The Code

1. App Context (`contextLib.ts`):

```jsx
/* eslint-disable @typescript-eslint/no-empty-function */
import { CognitoUser } from 'amazon-cognito-identity-js'
import { createContext, useContext } from 'react'
  isAuthenticated: boolean
export interface AppContextType {
  isAuthenticated: boolean
  userHasAuthenticated: React.Dispatch<React.SetStateAction<boolean>>
  cognitoUser: CognitoUser | null
  setCognitoUser: React.Dispatch<React.SetStateAction<CognitoUser | null>>
}


export const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  userHasAuthenticated: () => {},
  cognitoUser: null,
  setCognitoUser: () => {},
})

export function useAppContext() {
  return useContext(AppContext)
}
```

```jsx
function App() {
  const [isAuthenticated, userHasAuthenticated] = useState(false)
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null)
    <AppContext.Provider value={{ isAuthenticated, userHasAuthenticated: setIsAuthenticated }}>
  return (
    <AppContext.Provider value={{ isAuthenticated, userHasAuthenticated, cognitoUser, setCognitoUser }}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </AppContext.Provider>
  )
}
```

Login Component (`Login.tsx`):

```jsx
export default function Login() {
  const nav = useNavigate()
  const { userHasAuthenticated, setCognitoUser } = useAppContext()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  function validateForm() {
  function validateForm() {
    return email.length > 0 && password.length > 0
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      console.log('Attempting to sign in...')
      const user = await Auth.signIn(email, password)
      console.log('Sign in result:', user)
      const userName = user.username
      if (user.challengeName === 'NEW_PASSWORD_REQUIRED') {
      if (user.challengeName === 'NEW_PASSWORD_REQUIRED') {
        console.log('New password required')
        // Pass userName and cognitoUser to the reset-password route
        setCognitoUser(user)
        nav('/reset-password')
      } else {
        // Normal sign-in flow
        await Auth.currentSession()
        const currentAuthenticatedUser = await Auth.currentAuthenticatedUser({ bypassCache: true })
        console.log('Current authenticated user:', currentAuthenticatedUser)
        nav('/')
        userHasAuthenticated(true)
        nav('/')
      }
    } catch (error) {
```

Reset Password Component (`ResetPassword.tsx`):

```jsx
export default function ResetPassword() {
  const { cognitoUser, userHasAuthenticated } = useAppContext()
  const nav = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [error, setError] = useState('')
    function validateForm() {
      return newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword
    }
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }
    }
    try {
      if (!cognitoUser) {
        setError('User information is missing. Please try logging in again.')
        return
      }
      if (!cognitoUser) {
      console.log('Attempting to complete new password challenge...')
      await Auth.completeNewPassword(cognitoUser, newPassword)
      console.log('Password reset successful')
      userHasAuthenticated(true)
      nav('/')
    } catch (error) {
      console.error('Error resetting password:', error)
      onError(error)
      setError('Failed to reset password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
```