import re
from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, PasswordField, BooleanField, SubmitField, TextAreaField, SelectField, DateField, FloatField, FieldList, FormField, IntegerField, TimeField, SelectMultipleField, MultipleFileField
from wtforms.validators import DataRequired, Email, EqualTo, Length, Optional, ValidationError
from markupsafe import Markup
from datetime import date

# --- Custom Validators ---
def password_check(form, field):
    """Custom validator to check password complexity."""
    password = field.data
    errors = []
    if not re.search('[a-z]', password):
        errors.append('Must contain at least one lowercase letter.')
    if not re.search('[A-Z]', password):
        errors.append('Must contain at least one uppercase letter.')
    if not re.search('[0-9]', password):
        errors.append('Must contain at least one number.')
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', password):
        errors.append('Must contain at least one special character.')
    if errors:
        raise ValidationError(Markup('<br>'.join(errors)))

# --- Form Classes ---

# Auth Forms
class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')
    submit = SubmitField('Login')

class RegistrationForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=8, message='At least 8 characters long.'), password_check])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired(), EqualTo('password', message='Passwords must match.')])
    submit = SubmitField('Register')

class RequestPasswordResetForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    submit = SubmitField('Send Reset Instructions')

class ResetPasswordForm(FlaskForm):
    password = PasswordField('New Password', validators=[DataRequired(), Length(min=8), password_check])
    confirm_password = PasswordField('Confirm New Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Reset Password')

class ChangePasswordForm(FlaskForm):
    password = PasswordField('New Password', validators=[DataRequired(), Length(min=8), password_check])
    confirm_password = PasswordField('Confirm New Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Set New Password')

# Profile & User Forms
class UpdateProfileForm(FlaskForm):
    full_name = StringField('Full Name', validators=[Length(min=0, max=100)])
    phone_number = StringField('Phone Number', validators=[Length(min=0, max=20)])
    address = TextAreaField('Physical Address', validators=[Length(min=0, max=500)])
    profile_image = FileField('Update Profile Picture', validators=[FileAllowed(['jpg', 'png', 'jpeg', 'gif'], 'Images only!')])
    submit = SubmitField('Save Changes')

class AddStaffForm(FlaskForm):
    full_name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    email = StringField('Email', validators=[DataRequired(), Email(), Length(max=100)])
    phone_number = StringField('Phone Number', validators=[Length(max=20)])
    address = TextAreaField('Physical Address', validators=[Length(max=500)])
    id_number = StringField('South African ID Number', validators=[Length(min=13, max=13)])
    submit = SubmitField('Save Staff Member')

class EditStaffForm(FlaskForm):
    full_name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    phone_number = StringField('Phone Number', validators=[Length(max=20)])
    address = TextAreaField('Physical Address', validators=[Optional(), Length(max=500)])
    id_number = StringField('South African ID Number', validators=[Optional(), Length(min=13, max=13)])
    strengths = TextAreaField('Strengths / Key Skills', validators=[Optional(), Length(max=1000)])
    has_id_copy = BooleanField('Copy of ID on file')
    has_drivers_license = BooleanField("Driver's license on file")
    has_criminal_check = BooleanField('Criminal record check complete')
    upload_documents = MultipleFileField('Upload Supporting Documents', validators=[FileAllowed(['pdf', 'doc', 'docx', 'jpg', 'png', 'jpeg'], 'Documents or images only!')])
    profile_image = FileField('Update Profile Picture', validators=[FileAllowed(['jpg', 'png', 'jpeg', 'gif'], 'Only image files are allowed!')])
    submit = SubmitField('Update Profile')
    
class AddClientForm(FlaskForm):
    full_name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    email = StringField('Email', validators=[DataRequired(), Email(), Length(max=100)])
    phone_number = StringField('Phone Number', validators=[Length(max=20)])
    address = TextAreaField('Physical Address', validators=[Length(max=500)])
    submit = SubmitField('Save Client')

class EditClientForm(FlaskForm):
    full_name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    phone_number = StringField('Phone Number', validators=[Length(max=20)])
    address = TextAreaField('Physical Address', validators=[Length(max=500)])
    submit = SubmitField('Update Client')

# Content Forms
class PostForm(FlaskForm):
    title = StringField('Title', validators=[DataRequired(), Length(max=200)])
    content = TextAreaField('Full Content', validators=[DataRequired()])
    excerpt = TextAreaField('Excerpt (Short Summary)', validators=[Optional(), Length(max=300)])
    is_published = BooleanField('Publish this post')
    submit = SubmitField('Save Post')

# Quote & Invoice Forms
class QuoteLineItemForm(FlaskForm):
    description = TextAreaField('Description', validators=[DataRequired()])
    quantity = FloatField('Quantity', validators=[DataRequired()], default=1)
    unit_price = FloatField('Unit Price', validators=[DataRequired()])

class GuestQuoteForm(FlaskForm):
    client_or_guest_name = StringField('Client Name', validators=[DataRequired()])
    quote_number = StringField('Quote Number', validators=[Optional()])
    quote_date = DateField('Quote Date', default=date.today, validators=[DataRequired()])
    expiry_date = DateField('Expiry Date', validators=[Optional()])
    discount_value = FloatField('Discount', validators=[Optional()], default=0.0)
    discount_type = SelectField('Type', choices=[('R', 'R'), ('%', '%')], default='R')
    line_items = FieldList(FormField(QuoteLineItemForm), min_entries=1)
    submit = SubmitField('Save Quote')

class InvoiceLineItemForm(FlaskForm):
    description = TextAreaField('Description', validators=[DataRequired()])
    quantity = FloatField('Quantity', validators=[DataRequired()], default=1)
    unit_price = FloatField('Unit Price', validators=[DataRequired()])

class InvoiceForm(FlaskForm):
    client_or_guest_name = StringField('Client Name', validators=[DataRequired()])
    invoice_number = StringField('Invoice Number', validators=[Optional()])
    invoice_date = DateField('Invoice Date', default=date.today, validators=[DataRequired()])
    due_date = DateField('Due Date', validators=[Optional()])
    discount_value = FloatField('Discount', validators=[Optional()], default=0.0)
    discount_type = SelectField('Type', choices=[('R', 'R'), ('%', '%')], default='R')
    line_items = FieldList(FormField(InvoiceLineItemForm), min_entries=1)
    payment_advice = TextAreaField('Payment Advice', validators=[Optional()])
    submit = SubmitField('Create Invoice')

# Job & Scheduling Forms
class JobForm(FlaskForm):
    scheduled_date = DateField('Date', validators=[DataRequired()], format='%Y-%m-%d')
    start_time = TimeField('Start Time', validators=[Optional()])
    end_time = TimeField('End Time', validators=[Optional()])
    notes = TextAreaField('Job Notes', validators=[Optional(), Length(max=1000)])
    assigned_staff = SelectMultipleField('Assign Staff', coerce=int, validators=[Optional()])
    submit = SubmitField('Save Job')

class UpdateJobStatusForm(FlaskForm):
    status = SelectField('Status', choices=[('Scheduled', 'Scheduled'), ('In-Progress', 'In-Progress'), ('Completed', 'Completed'), ('Cancelled', 'Cancelled')], validators=[DataRequired()])
    submit = SubmitField('Update')

# Service & Pricing Forms
class ServiceCategoryForm(FlaskForm):
    name = StringField('Category Name', validators=[DataRequired(), Length(max=100)])
    description = TextAreaField('Description', validators=[Optional(), Length(max=500)])
    calculation_method = SelectField('Pricing Method', choices=[('options', 'User picks from list'), ('quantity', 'User enters quantity'), ('sqm', 'User enters square meters')], validators=[DataRequired()])
    submit = SubmitField('Save Category')

class ServiceItemForm(FlaskForm):
    name = StringField('Item Name', validators=[DataRequired(), Length(max=100)])
    estimated_time_mins = IntegerField('Estimated Time (Minutes)', validators=[Optional()], default=0)
    submit = SubmitField('Save Item')

class ServicePriceForm(FlaskForm):
    frequency = SelectField('Frequency', choices=[('Once-Off', 'Once-Off'), ('Weekly', 'Weekly'), ('Bi-Weekly', 'Bi-Weekly'), ('Monthly', 'Monthly')], validators=[DataRequired()])
    price = FloatField('Price (R)', validators=[DataRequired()])
    submit = SubmitField('Add Price')
    
class PlacementApplicationForm(FlaskForm):
    full_name = StringField('Full Name', validators=[DataRequired(), Length(max=100)])
    email = StringField('Email Address', validators=[DataRequired(), Email(), Length(max=100)])
    phone_number = StringField('Phone Number', validators=[DataRequired(), Length(max=20)])
    message = TextAreaField('Tell us what you are looking for', validators=[DataRequired(), Length(max=2000)])
    submit = SubmitField('Submit Application')