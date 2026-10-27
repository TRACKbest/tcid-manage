import React from 'react'

const UserLogout = () => {
    localStorage.removeItem('studentLoginStatus')
    localStorage.removeItem('studentId')
    localStorage.removeItem('teacherLoginStatus')
    localStorage.removeItem('teacherId')
    localStorage.removeItem('activeAccountType')
    window.location.href='/user-register?mode=login';
  return (
    <div>
      
    </div>
  )
}

export default UserLogout
